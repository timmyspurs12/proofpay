"""Direct-mode tests (genlayer-test). Run with: pytest contracts/tests/test_direct.py
after `pip install genlayer-test` (see docs/GENLAYER.md). Skipped automatically
when the framework is not installed so the static suite stays green anywhere.
"""
import json

import pytest

# Direct-mode fixtures (direct_vm / direct_deploy / direct_alice) are provided
# by the genlayer-test pytest plugin (gltest_direct). Skip cleanly without it.
try:
    import glsim  # noqa: F401
except ImportError:
    pytest.skip("genlayer-test not installed — see docs/GENLAYER.md", allow_module_level=True)

CONTRACT = "contracts/proofpay_adjudicator.py"
CRITERIA = json.dumps([{"id": "crit_1", "text": "API endpoint live and documented"}])
EVIDENCE = json.dumps(
    [{"id": "ev1", "criterionId": "crit_1", "role": "PROVIDER", "type": "GITHUB", "title": "repo", "summary": "endpoint present", "contentHash": "abc"}]
)
VERDICT = json.dumps(
    {
        "decision": "SELLER_WINS",
        "provider_share_bps": None,
        "rationale": "Provider evidence covers the criterion and is unrebutted.",
        "evidence_refs": ["ev1"],
        "uncertainties": [],
        "criterion_findings": [{"criterion_id": "crit_1", "finding": "MET", "note": "endpoint documented"}],
    }
)


def test_adjudicate_stores_verdict(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r".*adjudicator.*", VERDICT)
    contract.adjudicate("case1", "agr1", "hash1", CRITERIA, EVIDENCE, "client says no", "provider says yes", True)
    stored = json.loads(contract.get_verdict("case1"))
    assert stored["decision"] == "SELLER_WINS"
    assert contract.get_case_status("case1") == "DECIDED"


def test_second_adjudication_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r".*adjudicator.*", VERDICT)
    contract.adjudicate("case1", "agr1", "hash1", CRITERIA, EVIDENCE, "a", "b", True)
    with direct_vm.expect_revert("already decided"):
        contract.adjudicate("case1", "agr1", "hash1", CRITERIA, EVIDENCE, "a", "b", True)
