import oracledb

ORACLE_CLIENT_DIR = r"C:\app\oracle\instantclient"

DB_USER = "SUPPORT"
DB_PASSWORD = "SUPPORT123"
DB_DSN = "edhdb.intranet.fw:1521/EDH_PRO"

_client_initialized = False


def init_oracle():
    global _client_initialized

    if _client_initialized:
        return

    try:
        oracledb.init_oracle_client(
            lib_dir=ORACLE_CLIENT_DIR
        )
    except Exception:
        pass

    _client_initialized = True


def get_connection():
    init_oracle()

    return oracledb.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        dsn=DB_DSN
    )