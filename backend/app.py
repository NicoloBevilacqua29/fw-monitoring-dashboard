from flask import Flask, jsonify, request
from flask_cors import CORS

from queries import get_oracle_instances

app = Flask(__name__)
CORS(app)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/query", methods=["POST"])
def query():

    data = request.get_json(silent=True) or {}

    command = (
        data.get("command", "")
        .strip()
        .lower()
    )

    if command == "stato edh":
        return jsonify({
            "ok": True,
            "command": command,
            "data": get_oracle_instances()
        })

    return jsonify({
        "ok": False,
        "error": f"Comando non riconosciuto: {command}"
    }), 400


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )