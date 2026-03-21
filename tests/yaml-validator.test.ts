/**
 * YAML Validator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateConfigYaml,
  validateCategoriesYaml,
  validateWorkflowYaml,
} from '../src/server/config/validator.js';

describe('validateConfigYaml', () => {
  it('should accept valid config', () => {
    const yaml = `
company:
  name: "Test Corp"
  industry: manufacturing
identity:
  provider: manual
  sync_interval: 15m
  attributes:
    - department
    - title
system_governance:
  description: "Controls system config"
  steps:
    - role: admin
      action: submit
    - role: owner
      action: approve
      required: true
`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing company name', () => {
    const yaml = `
company:
  industry: manufacturing
identity:
  provider: manual
system_governance:
  description: "test"
  steps:
    - role: admin
      action: submit
`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('company.name'))).toBe(true);
  });

  it('should reject invalid provider', () => {
    const yaml = `
company:
  name: "Test"
identity:
  provider: invalid_provider
system_governance:
  description: "test"
  steps:
    - role: admin
      action: submit
`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('provider'))).toBe(true);
  });

  it('should reject invalid YAML syntax', () => {
    const result = validateConfigYaml('{ invalid yaml ::');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid YAML');
  });
});

describe('validateWorkflowYaml', () => {
  it('should accept valid workflow', () => {
    const yaml = `
name: Policy Approval
description: "Policies require approval"
applies_to:
  category: POL
steps:
  - role: approver
    action: approve
    required: true
`;
    const result = validateWorkflowYaml(yaml);
    expect(result.valid).toBe(true);
  });

  it('should reject steps without role or match', () => {
    const yaml = `
name: Bad Workflow
applies_to:
  category: POL
steps:
  - action: approve
`;
    const result = validateWorkflowYaml(yaml);
    expect(result.valid).toBe(false);
  });
});
