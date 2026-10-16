#!/usr/bin/env python3
"""Validate JSON files against a draft 2020-12 JSON Schema.

Usage: python3 schemas/check_schema.py SCHEMA FILE [FILE ...]

The schema itself is checked first with Draft202012Validator.check_schema.
Integers are checked the way radar_ml.validate checks them (Python int only),
so 1.0 is not accepted as an integer. NaN/Infinity are rejected as non-JSON.
Needs the Python standard library plus the jsonschema package.

Exit status: 0 every file is valid, 1 at least one file is invalid,
2 usage error, unreadable input or an invalid schema.
"""
import json
import sys

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover - environment problem
    sys.exit('check_schema: the jsonschema package is required (pip install jsonschema)')

DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema'
MAX_ERRORS_PER_FILE = 50
MAX_MESSAGE = 300


def load_json(path):
    def reject(constant):
        raise ValueError('non-finite number ' + constant + ' is not valid JSON')
    with open(path, encoding='utf-8') as stream:
        return json.load(stream, parse_constant=reject)


def strict_integer(_checker, value):
    return isinstance(value, int) and not isinstance(value, bool)


def location(error):
    out = '$'
    for part in error.absolute_path:
        out += '[' + str(part) + ']' if isinstance(part, int) else '.' + str(part)
    return out


def shorten(text):
    if len(text) <= MAX_MESSAGE:
        return text
    half = MAX_MESSAGE // 2  # keep the tail, which says what is wrong ("is too long")
    return text[:half] + ' ... ' + text[-half:]


def describe(error):
    if error.validator == 'not' and error.validator_value == {}:  # $defs/absent
        key = error.absolute_path[-1] if error.absolute_path else '?'
        message = 'key ' + repr(key) + ' is not allowed here: this producer never emits it'
    else:
        message = shorten(error.message)
    if error.context:  # anyOf/oneOf: show why each alternative failed
        reasons = []
        for sub in sorted(error.context, key=lambda e: list(e.schema_path)):
            reason = shorten(sub.message)
            if reason not in reasons:
                reasons.append(reason)
        message += ' (' + '; '.join(reasons[:4]) + ')'
    keyword = '/'.join(str(p) for p in error.absolute_schema_path)
    return location(error) + ': ' + message + '  [schema: ' + keyword + ']'


def main(argv):
    if len(argv) < 3 or argv[1] in ('-h', '--help'):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    schema_path, files = argv[1], argv[2:]
    try:
        schema = load_json(schema_path)
    except (OSError, ValueError) as e:
        print(schema_path + ': cannot read schema: ' + str(e), file=sys.stderr)
        return 2
    if not isinstance(schema, dict) or schema.get('$schema') != DRAFT_2020_12:
        print(schema_path + ': schema must declare "$schema": "' + DRAFT_2020_12 + '"', file=sys.stderr)
        return 2
    try:
        Draft202012Validator.check_schema(schema)
    except jsonschema.exceptions.SchemaError as e:
        print(schema_path + ': invalid JSON Schema at ' + '/'.join(str(p) for p in e.absolute_path) + ': ' + e.message, file=sys.stderr)
        return 2
    validator_class = jsonschema.validators.extend(
        Draft202012Validator,
        type_checker=Draft202012Validator.TYPE_CHECKER.redefine('integer', strict_integer))
    validator = validator_class(schema)

    status, bad = 0, 0
    for name in files:
        try:
            instance = load_json(name)
        except (OSError, UnicodeDecodeError, ValueError) as e:
            print('FAIL ' + name + ': cannot read JSON: ' + str(e))
            status, bad = 2, bad + 1
            continue
        errors = sorted(validator.iter_errors(instance),
                        key=lambda e: ([str(p) for p in e.absolute_path], [str(p) for p in e.absolute_schema_path]))
        if not errors:
            print('OK   ' + name)
            continue
        bad += 1
        status = max(status, 1)
        print('FAIL ' + name + ': ' + str(len(errors)) + ' schema error(s)')
        for error in errors[:MAX_ERRORS_PER_FILE]:
            print('  ' + describe(error))
        if len(errors) > MAX_ERRORS_PER_FILE:
            print('  ... ' + str(len(errors) - MAX_ERRORS_PER_FILE) + ' more')
    print(str(len(files) - bad) + '/' + str(len(files)) + ' file(s) valid against ' + schema_path)
    return status


if __name__ == '__main__':
    sys.exit(main(sys.argv))
