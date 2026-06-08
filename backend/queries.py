from db import get_connection


def get_oracle_instances():
    conn = get_connection()

    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                INSTANCE_NAME,
                HOST_NAME,
                STATUS
            FROM SYS.GV_$INSTANCE
            ORDER BY INSTANCE_NAME
        """)

        rows = []

        for row in cur.fetchall():
            rows.append({
                "instance": row[0],
                "host": row[1],
                "status": row[2]
            })

        return rows

    finally:
        cur.close()
        conn.close()