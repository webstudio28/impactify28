#!/usr/bin/env bash
# API-only test for POST /api/track/conversion
#
# Usage:
#   export IMPACT28_WORKSPACE_ID="your-profiles-uuid"
#   export IMPACT28_BASE_URL="http://localhost:3000"   # optional
#   ./scripts/test-sales-conversion.sh
#
# Optional:
#   export IMPACT28_ORDER_ID="test-order-001"
#   export IMPACT28_ORDER_VALUE="42.5"
#   export IMPACT28_CURRENCY="BGN"
#   export IMPACT28_CAMPAIGN_TOKEN="paste-cmp-token-from-results-page"

set -euo pipefail

BASE_URL="${IMPACT28_BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
WORKSPACE_ID="${IMPACT28_WORKSPACE_ID:-}"
ORDER_ID="${IMPACT28_ORDER_ID:-test-order-$(date +%Y%m%d-%H%M%S)}"
VALUE="${IMPACT28_ORDER_VALUE:-42.5}"
CURRENCY="${IMPACT28_CURRENCY:-BGN}"

if [[ -z "$WORKSPACE_ID" ]]; then
  echo "Set IMPACT28_WORKSPACE_ID to your profiles.id (Supabase profiles table)." >&2
  exit 1
fi

if [[ -n "${IMPACT28_CAMPAIGN_TOKEN:-}" ]]; then
  BODY=$(jq -n \
    --arg w "$WORKSPACE_ID" \
    --arg o "$ORDER_ID" \
    --argjson v "$VALUE" \
    --arg c "$CURRENCY" \
    --arg t "$IMPACT28_CAMPAIGN_TOKEN" \
    '{workspaceId:$w, orderId:$o, value:$v, currency:$c, campaignToken:$t}')
else
  BODY=$(jq -n \
    --arg w "$WORKSPACE_ID" \
    --arg o "$ORDER_ID" \
    --argjson v "$VALUE" \
    --arg c "$CURRENCY" \
    '{workspaceId:$w, orderId:$o, value:$v, currency:$c}')
fi

URL="$BASE_URL/api/track/conversion"
echo "POST $URL"
echo "Body: $BODY"

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  | jq .

echo ""
echo "Verify in Supabase:"
echo "  SELECT * FROM campaign_sales_events WHERE order_id = '$ORDER_ID';"
