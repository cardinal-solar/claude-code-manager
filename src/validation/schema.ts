import { z } from 'zod';

// Avoid type inference issues by importing as any
const zodToJsonSchema: any = require('zod-to-json-schema').zodToJsonSchema;

export class SchemaValidator {
  static toJsonSchema(schema: z.ZodType<any, any, any>): any {
    return zodToJsonSchema(schema);
  }

  static validate<T extends z.ZodType<any, any, any>>(
    data: unknown,
    schema: T
  ): { success: true; data: any } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }
}
