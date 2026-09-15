#!/usr/bin/env bash
# Verificación post-fix Quatun: create plan + visibilidad productor 80080 (sis2000_qa)
# Ejecutar en jsoto@srv001
set -euo pipefail
unset PORT DATABASE_URL
set +H

APIKEY="${NEST_API_KEY:-$(grep '^NEST_API_KEY=' ~/producto-builder/backend/.env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
if [ -z "$APIKEY" ]; then
  echo "ERROR: NEST_API_KEY vacía"
  exit 1
fi

# Código único por ejecución (máx 6 chars)
SUF=$(date +%H%M | tail -c 4)
CPLAN="T9${SUF}"
echo "=== Plan de prueba: $CPLAN (producto TST908) ==="

python3 - "$CPLAN" <<'PY'
import json, sys
cplan = sys.argv[1]
payload = {
  "type": "personas",
  "operation": "C",
  "cusuario": 4,
  "cplan": cplan,
  "xplan": f"Post-fix Quatun visibilidad 80080 {cplan}",
  "fdesde": "2020-01-01",
  "fhasta": "2099-12-31",
  "cramo": 8,
  "cmoneda": "USD",
  "cproducto": "TST908",
  "itiporen": "N",
  "idevolucion": "N",
  "iestado": "V",
  "all_productor": False,
  "all_canal": False,
  "productores": [{"cproductor": 80080}],
  "coberturas": [{
    "ccobertura": 908,
    "ctarifa": 1,
    "bobligatoria": True,
    "parentescos": [{
      "cparen": 1,
      "csexo": "A",
      "ctablatar": "PRUEB",
      "nedad_min": 0,
      "nedad_max": 99,
      "msuma": 1000,
      "msumamax": 1000,
      "mprima": 10
    }]
  }],
  "frecuencias": [{
    "ifrecuencia": "A",
    "xfrecuencia": "Anual",
    "ndias": 365
  }]
}
with open("/tmp/create-plan.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
print("JSON:", "/tmp/create-plan.json")
PY

echo ""
echo "=== 1) POST partner/starter/plan ==="
HTTP=$(curl -s -o /tmp/plan-resp.json -w "%{http_code}" \
  -X POST http://127.0.0.1:3002/api/v1/partner/starter/plan \
  -H "apikey: $APIKEY" \
  -H 'Content-Type: application/json' \
  -d @/tmp/create-plan.json)
echo "HTTP:$HTTP"
python3 -m json.tool /tmp/plan-resp.json || cat /tmp/plan-resp.json

if python3 -c "import json; d=json.load(open('/tmp/plan-resp.json')); exit(0 if d.get('status') is True or (d.get('status') is None and 'error' not in d) else 1)" 2>/dev/null; then
  :
else
  if grep -q "ya existe" /tmp/plan-resp.json 2>/dev/null; then
    echo "Plan duplicado — reintenta (el script genera otro cplan)"
  fi
  if grep -q "IDENTITY_INSERT" /tmp/plan-resp.json 2>/dev/null; then
    echo "FALLO: fix mausuplan aún no aplicado en sis2000_qa"
    exit 2
  fi
fi

echo ""
echo "=== 2) POST valrep/planes/producto (P / 80080) ==="
HTTP2=$(curl -s -o /tmp/valrep.json -w "%{http_code}" \
  -H "apikey: $APIKEY" \
  -H 'Content-Type: application/json' \
  -X POST http://127.0.0.1:3002/api/v1/valrep/planes/producto \
  -d '{"cproducto":"TST908","centidad":"P","citem":"80080"}')
echo "HTTP:$HTTP2"
python3 -m json.tool /tmp/valrep.json || cat /tmp/valrep.json

echo ""
echo "=== 3) Resumen ==="
python3 <<PY
import json
plan = json.load(open("/tmp/plan-resp.json"))
val = json.load(open("/tmp/valrep.json"))
cplan = "$CPLAN"
err = plan.get("error") or plan.get("message") or ""
ok_plan = plan.get("status") is True or ("error" not in plan and plan.get("statusCode", 200) < 400)
data = val.get("data") or {}
planes = data.get("plan") or data.get("planes") or []
codes = [str(p.get("cplan","")).strip() for p in planes] if isinstance(planes, list) else []
print("Create plan status:", plan.get("status"), "| error:", err[:120] if err else "—")
print("Valrep HTTP body status:", val.get("status"), "| mensaje:", (data.get("mensaje") or val.get("message") or "")[:80])
print("Planes visibles:", codes if codes else "(ninguno)")
print("Incluye", cplan + ":", cplan in codes or any(cplan in c for c in codes))
PY

echo ""
echo "SQL DBeaver (sis2000_qa):"
echo "  SELECT * FROM mausuplan WHERE TRIM(cplan) = '$CPLAN' OR citem = '80080';"
