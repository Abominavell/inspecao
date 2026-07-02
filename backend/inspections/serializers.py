from rest_framework import serializers

from inspections.models import (
    ChecklistItem,
    ChecklistSection,
    Inspection,
    InspectionAnswer,
    Photo,
    Unit,
)
from inspections.services.cover import default_cover_fields
from inspections.services.scoring import compute_section_scores


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = (
            "id",
            "name",
            "regional",
            "city",
            "address",
            "unit_type",
            "employee_count",
            "admin_coordinator",
            "general_director",
            "characterization",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class UnitBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "name", "regional", "city")


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ("id", "order", "item_code", "question")


class ChecklistSectionSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = ChecklistSection
        fields = ("id", "order", "title", "items")


class PhotoSerializer(serializers.ModelSerializer):
    file_path = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = ("id", "answer_id", "file_path", "original_filename", "url")

    def get_file_path(self, obj):
        return obj.file_path

    def get_url(self, obj):
        request = self.context.get("request")
        inspection_id = self.context.get("inspection_id")
        if request and inspection_id:
            return request.build_absolute_uri(
                f"/inspections/{inspection_id}/photos/{obj.id}"
            )
        return f"/inspections/{inspection_id}/photos/{obj.id}"


class AnswerSerializer(serializers.ModelSerializer):
    checklist_item_id = serializers.IntegerField(read_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = InspectionAnswer
        fields = (
            "id",
            "checklist_item_id",
            "status",
            "description",
            "recommendation",
            "normative",
            "photos",
        )

    def get_photos(self, obj):
        return PhotoSerializer(
            obj.photos.all(),
            many=True,
            context={**self.context, "inspection_id": obj.inspection_id},
        ).data


class AnswerInputSerializer(serializers.Serializer):
    checklist_item_id = serializers.IntegerField()
    status = serializers.ChoiceField(
        choices=[None, "C", "NC", "NA"], allow_null=True, required=False
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    recommendation = serializers.CharField(required=False, allow_blank=True, default="")
    normative = serializers.CharField(required=False, allow_blank=True, default="")


class AnswersBatchSerializer(serializers.Serializer):
    answers = AnswerInputSerializer(many=True)


class InspectionSerializer(serializers.ModelSerializer):
    unit = UnitBriefSerializer(read_only=True)
    unit_id = serializers.PrimaryKeyRelatedField(
        queryset=Unit.objects.all(), source="unit"
    )
    overall_score = serializers.SerializerMethodField()
    has_address_photo = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    checklist_version_label = serializers.CharField(
        source="checklist_version.label", read_only=True, default=""
    )

    class Meta:
        model = Inspection
        fields = (
            "id",
            "unit_id",
            "unit",
            "inspection_date",
            "report_date",
            "status",
            "is_archived",
            "methodology_text",
            "objectives_text",
            "limitations_text",
            "final_considerations_text",
            "general_info_text",
            "cover_diretoria_executiva",
            "cover_diretor_executivo",
            "cover_gerencia_geral",
            "cover_gerente_geral",
            "cover_gerencia_sst",
            "cover_gerente_sst",
            "cover_gerencia_meio_ambiente",
            "cover_gerente_meio_ambiente",
            "created_at",
            "updated_at",
            "overall_score",
            "has_address_photo",
            "created_by_id",
            "created_by_name",
            "checklist_version_label",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "overall_score",
            "has_address_photo",
            "created_by_id",
            "created_by_name",
            "checklist_version_label",
            "is_archived",
        )

    def get_overall_score(self, obj):
        return compute_section_scores(obj).get("overall_score")

    def get_has_address_photo(self, obj) -> bool:
        return bool(obj.address_photo)

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        from inspections.services.checklist_version import get_active_checklist_version

        version = get_active_checklist_version()
        if version:
            validated_data["checklist_version"] = version
        for field, value in default_cover_fields().items():
            validated_data.setdefault(field, value)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if instance.status == Inspection.Status.FINALIZADO:
            allowed = {"status"}
            if not self.context["request"].user.is_staff:
                raise serializers.ValidationError("Inspeção finalizada não pode ser editada")
            extra = set(validated_data.keys()) - allowed
            if extra:
                raise serializers.ValidationError(
                    "Inspeção finalizada: reabra antes de editar outros campos"
                )
        return super().update(instance, validated_data)


class SectionScoreSerializer(serializers.Serializer):
    section_id = serializers.IntegerField()
    section_order = serializers.IntegerField()
    section_title = serializers.CharField()
    conforme = serializers.IntegerField()
    nao_conforme = serializers.IntegerField()
    nao_aplicavel = serializers.IntegerField()
    total_applicable = serializers.IntegerField()
    score = serializers.FloatField(allow_null=True)


class ScoresSerializer(serializers.Serializer):
    sections = SectionScoreSerializer(many=True)
    overall_conforme = serializers.IntegerField()
    overall_nao_conforme = serializers.IntegerField()
    overall_nao_aplicavel = serializers.IntegerField()
    overall_score = serializers.FloatField(allow_null=True)


class NonConformitySerializer(serializers.Serializer):
    item_code = serializers.CharField()
    question = serializers.CharField()
    description = serializers.CharField()
    normative = serializers.CharField()
    recommendation = serializers.CharField()
    section_title = serializers.CharField()
    photos = serializers.ListField(child=serializers.CharField())


class CompletenessSerializer(serializers.Serializer):
    unit_complete = serializers.BooleanField()
    address_photo_complete = serializers.BooleanField()
    cover_complete = serializers.BooleanField()
    texts_complete = serializers.BooleanField()
    checklist_answered = serializers.IntegerField()
    checklist_total = serializers.IntegerField()
    checklist_complete = serializers.BooleanField()
    nc_without_photo = serializers.IntegerField()
    ready_for_report = serializers.BooleanField()
    pending_items = serializers.ListField(child=serializers.CharField(), default=list)
    pending_count = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.CharField(), required=False, default=list)
