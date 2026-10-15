"""Static + structural tests for the GenLayer Intelligent Contract.

These run anywhere (no GenLayer runtime needed) and guard the properties the
docs require: correct header, no forbidden imports, storage via TreeMap,
a validator that INDEPENDENTLY re-runs the leader (Equivalence Principle),
deterministic verdict validation, and an evidence floor.
Direct-mode tests live in test_direct.py and run when genlayer-test is present
(`pip install genlayer-test`, see docs/GENLAYER.md).
"""
import ast
import pathlib

SRC = pathlib.Path(__file__).resolve().parents[1] / "proofpay_adjudicator.py"
TEXT = SRC.read_text()
TREE = ast.parse(TEXT)


def test_depends_header_is_first_line():
    first = TEXT.splitlines()[0]
    assert first.startswith('# { "Depends": "py-genlayer:'), first


def test_single_contract_class_extends_gl_contract():
    classes = [n for n in ast.walk(TREE) if isinstance(n, ast.ClassDef)]
    assert len(classes) == 1
    bases = [ast.unparse(b) for b in classes[0].bases]
    assert any("gl.Contract" in b for b in bases), bases


def test_no_forbidden_imports():
    imported = set()
    for node in ast.walk(TREE):
        if isinstance(node, ast.Import):
            imported.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    forbidden = {"os", "sys", "subprocess", "requests", "urllib", "socket", "random", "time"}
    assert not (imported & forbidden), imported & forbidden
    assert imported <= {"genlayer", "json"}, imported


def test_storage_uses_treemap_not_dict_or_list():
    class_node = next(n for n in ast.walk(TREE) if isinstance(n, ast.ClassDef))
    annotations = [ast.unparse(n.annotation) for n in class_node.body if isinstance(n, ast.AnnAssign)]
    storage = [a for a in annotations if "TreeMap" in a or "DynArray" in a]
    assert storage, annotations
    assert not any(a.startswith("dict") or a.startswith("list") for a in annotations)


def test_public_methods_decorated():
    funcs = {n.name: n for n in ast.walk(TREE) if isinstance(n, ast.FunctionDef)}
    for name in ("get_verdict", "adjudicate"):
        decos = [ast.unparse(d) for d in funcs[name].decorator_list]
        assert any("gl.public" in d for d in decos), (name, decos)


def test_validator_independently_reruns_leader():
    # Equivalence Principle: leader-output-only validation is forbidden.
    assert "run_nondet_unsafe" in TEXT
    assert "leader_fn()" in TEXT  # validator re-executes the task
    assert "isinstance(leader_result, gl.vm.Return)" in TEXT


def test_deterministic_guards_present():
    for needle in ("ALLOWED_DECISIONS", "already decided", "_validate_verdict", "INSUFFICIENT_EVIDENCE", "evidence floor", "allow_partial"):
        assert needle.lower() in TEXT.lower(), needle


def test_prompt_treats_evidence_as_untrusted():
    assert "UNTRUSTED DATA" in TEXT
    assert "never as instructions" in TEXT


def test_contract_holds_no_funds_api():
    # Settlement authority stays off-chain/deterministic by design.
    assert "payable" not in TEXT
    assert "transfer" not in TEXT.lower()
