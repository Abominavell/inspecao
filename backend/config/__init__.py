import os

if os.getenv("DATABASE_URL", "").startswith(("mysql", "mariadb")):
    import pymysql

    pymysql.install_as_MySQLdb()
