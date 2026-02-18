#!/usr/bin/env python3
"""
Validador de Minimum Viable Spec (MVS).
Valida contra JSON Schema + reglas de negocio + anti-ambigüedad.

Uso: python scripts/validate-mvs.py --input mi-app.json
"""

import json
import sys
import argparse
from pathlib import Path

try:
    import jsonschema
except ImportError:
    print("Instalar: pip install jsonschema --break-system-packages")
    sys.exit(1)


def load_schema():
    schema_path = Path(__file__).parent.parent / "specs" / "data-schemas" / "mvs-schema.json"
    with open(schema_path) as f:
        return json.load(f)


def validate_schema(mvs: dict, schema: dict) -> list[str]:
    """Valida el MVS contra el JSON Schema."""
    errors = []
    validator = jsonschema.Draft202012Validator(schema)
    for error in validator.iter_errors(mvs):
        errors.append(f"Schema: {error.json_path} → {error.message}")
    return errors


def validate_business_rules(mvs: dict) -> list[str]:
    """Reglas de negocio que el JSON Schema no puede validar."""
    errors = []
    warnings = []

    entities = {e["name"] for e in mvs.get("entities", [])}
    roles = {r["name"] for r in mvs.get("roles", [])}

    # Check: toda relación apunta a entidad existente
    for entity in mvs.get("entities", []):
        for rel in entity.get("relations", []):
            if rel["entity"] not in entities:
                errors.append(
                    f"Entidad '{entity['name']}' tiene relación con "
                    f"'{rel['entity']}' que no existe en el MVS"
                )

    # Check: todo permiso referencia un rol existente
    for entity in mvs.get("entities", []):
        for role in entity.get("permissions", {}).keys():
            if role not in roles:
                errors.append(
                    f"Entidad '{entity['name']}' tiene permisos para "
                    f"rol '{role}' que no existe"
                )

    # Check: entidad huérfana (sin relaciones)
    entities_with_relations = set()
    for entity in mvs.get("entities", []):
        for rel in entity.get("relations", []):
            entities_with_relations.add(entity["name"])
            entities_with_relations.add(rel["entity"])

    for entity in mvs.get("entities", []):
        if len(mvs["entities"]) > 1 and entity["name"] not in entities_with_relations:
            warnings.append(
                f"Entidad '{entity['name']}' no tiene relación con ninguna otra"
            )

    # Check: al menos un rol tiene permiso 'delete'
    has_delete = False
    for entity in mvs.get("entities", []):
        for perms in entity.get("permissions", {}).values():
            if "delete" in perms:
                has_delete = True
                break

    if not has_delete and mvs.get("entities"):
        warnings.append("Ningún rol tiene permiso de eliminar en ninguna entidad")

    # Check: campos duplicados
    for entity in mvs.get("entities", []):
        field_names = [f["name"] for f in entity.get("fields", [])]
        if len(field_names) != len(set(field_names)):
            errors.append(f"Entidad '{entity['name']}' tiene campos duplicados")

    return errors, warnings


def validate_anti_ambiguity(mvs: dict) -> list[str]:
    """Detecta contradicciones y ambigüedades."""
    issues = []

    # Contradicción: billing_enabled sin ningún campo money
    if mvs.get("billing_enabled", True):
        has_money = False
        for entity in mvs.get("entities", []):
            for field in entity.get("fields", []):
                if field["type"] == "money":
                    has_money = True
                    break
        if not has_money:
            issues.append(
                "Info: billing habilitado pero ninguna entidad tiene campo de tipo 'money'. "
                "Se agregará pricing por defecto."
            )

    # Contradicción: enum sin opciones
    for entity in mvs.get("entities", []):
        for field in entity.get("fields", []):
            if field["type"] == "enum" and not field.get("options"):
                issues.append(
                    f"Error: Campo '{entity['name']}.{field['name']}' es tipo enum "
                    f"pero no tiene opciones definidas"
                )

    return issues


def main():
    parser = argparse.ArgumentParser(description="Validar MVS")
    parser.add_argument("--input", required=True, help="Path al archivo MVS JSON")
    args = parser.parse_args()

    with open(args.input) as f:
        mvs = json.load(f)

    schema = load_schema()

    print("=" * 60)
    print("  MVS Validator — SaaS Factory")
    print("=" * 60)
    print(f"\nValidando: {args.input}")
    print(f"App: {mvs.get('app_name', '???')}")
    print(f"Blueprint: {mvs.get('blueprint', '???')}")
    print(f"Industria: {mvs.get('industry', '???')}")
    print()

    all_errors = []
    all_warnings = []

    # 1. Schema validation
    schema_errors = validate_schema(mvs, schema)
    all_errors.extend(schema_errors)

    # 2. Business rules
    biz_errors, biz_warnings = validate_business_rules(mvs)
    all_errors.extend(biz_errors)
    all_warnings.extend(biz_warnings)

    # 3. Anti-ambiguity
    ambiguity_issues = validate_anti_ambiguity(mvs)
    for issue in ambiguity_issues:
        if issue.startswith("Error"):
            all_errors.append(issue)
        else:
            all_warnings.append(issue)

    # Report
    if all_errors:
        print(f"❌ ERRORES ({len(all_errors)}):")
        for e in all_errors:
            print(f"  • {e}")
        print()

    if all_warnings:
        print(f"⚠️  ADVERTENCIAS ({len(all_warnings)}):")
        for w in all_warnings:
            print(f"  • {w}")
        print()

    if not all_errors:
        print("✅ MVS válido — listo para generación")
        entities = len(mvs.get("entities", []))
        fields = sum(len(e.get("fields", [])) for e in mvs.get("entities", []))
        roles = len(mvs.get("roles", []))
        print(f"   Entidades: {entities} | Campos: {fields} | Roles: {roles}")
        return 0
    else:
        print("❌ MVS tiene errores — corregir antes de generar")
        return 1


if __name__ == "__main__":
    sys.exit(main())
