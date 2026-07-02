from django.contrib import admin

from inspections.models import (
    ChecklistItem,
    ChecklistSection,
    Inspection,
    InspectionAnswer,
    Photo,
    Unit,
)

admin.site.register(Unit)
admin.site.register(ChecklistSection)
admin.site.register(ChecklistItem)
admin.site.register(Inspection)
admin.site.register(InspectionAnswer)
admin.site.register(Photo)
