---
name: validate-output
description: Validate result.json against schema.json
---

# Output Validation

This skill helps you validate your output against the required schema.

## Usage

1. Ensure `result.json` exists in the current directory
2. Ensure `schema.json` exists in the current directory
3. Use this skill to validate the result

## Validation Process

The validation will check:
- JSON syntax is valid
- All required fields are present
- Field types match the schema
- Additional constraints are satisfied

## If Validation Fails

1. Read the error message carefully
2. Check which field failed validation
3. Fix the issue in `result.json`
4. Validate again

## Example

```bash
# Your result.json
{
  "name": "John",
  "age": 30
}

# Schema requires
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name", "age"]
}

# This validates successfully!
```
