---
name: execute-task
description: Execute a structured task with validated JSON output
---

# Task Execution with Structured Output

You are executing a task that requires structured, validated output.

## Instructions

1. Read task details from `instructions.json` in the working directory
2. Read the JSON Schema from `schema.json` for output structure requirements
3. Read template variables from `variables.json` (if present)
4. Execute the task described in the prompt
5. Write your result to `result.json` matching the provided schema
6. Write execution logs to `logs.txt`
7. Save any generated files to `artifacts/` directory
8. Validate your output before finishing

## Output Format

Your `result.json` must validate against the JSON Schema provided in `schema.json`.

The schema defines the exact structure your output should have. Ensure all required fields are present and have the correct types.

## Example Workflow

1. Read instructions:
   ```bash
   cat instructions.json
   ```

2. Read schema requirements:
   ```bash
   cat schema.json
   ```

3. Complete the task as described

4. Write your result:
   ```bash
   echo '{"your": "result"}' > result.json
   ```

5. Write logs:
   ```bash
   echo "Task completed successfully" > logs.txt
   ```

6. Validate (use the /validate-output skill if available)

## Completion Checklist

Before finishing, ensure:
- [ ] result.json exists and contains valid JSON
- [ ] result.json matches the schema structure
- [ ] logs.txt contains execution details
- [ ] artifacts/ has any generated files
- [ ] All required schema fields are present
