/**
 * git4docs Config Validator
 * Validates YAML syntax and schema before allowing config changes.
 */

import yaml from 'js-yaml';
import type {
  CompanyConfig,
  CategoriesConfig,
  WorkflowConfig,
  MatchRule,
} from '../../shared/types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfigYaml(content: string): ValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    return { valid: false, errors: [`Invalid YAML syntax: ${(e as Error).message}`] };
  }

  const config = parsed as CompanyConfig;

  if (!config.company?.name) {
    errors.push('company.name is required');
  }
  if (!config.identity?.provider) {
    errors.push('identity.provider is required');
  } else if (!['azure_ad', 'okta', 'google', 'manual'].includes(config.identity.provider)) {
    errors.push(`identity.provider must be one of: azure_ad, okta, google, manual`);
  }
  if (!config.system_governance?.steps?.length) {
    errors.push('system_governance.steps must have at least one step');
  }

  return { valid: errors.length === 0, errors };
}

export function validateCategoriesYaml(content: string): ValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    return { valid: false, errors: [`Invalid YAML syntax: ${(e as Error).message}`] };
  }

  const config = parsed as CategoriesConfig;

  if (!Array.isArray(config.categories)) {
    return { valid: false, errors: ['categories must be an array'] };
  }

  const prefixes = new Set<string>();
  for (const [i, cat] of config.categories.entries()) {
    const prefix = `categories[${i}]`;

    if (!cat.prefix) errors.push(`${prefix}.prefix is required`);
    else if (prefixes.has(cat.prefix)) errors.push(`${prefix}.prefix "${cat.prefix}" is duplicate`);
    else prefixes.add(cat.prefix);

    if (!cat.name) errors.push(`${prefix}.name is required`);
    if (!cat.workflow) errors.push(`${prefix}.workflow is required`);
    if (!cat.numbering) errors.push(`${prefix}.numbering is required`);

    if (!cat.roles) {
      errors.push(`${prefix}.roles is required`);
    } else {
      for (const role of ['viewer', 'editor', 'approver'] as const) {
        if (!cat.roles[role]?.match) {
          errors.push(`${prefix}.roles.${role}.match is required`);
        } else {
          const matchErrors = validateMatchRule(cat.roles[role].match, `${prefix}.roles.${role}.match`);
          errors.push(...matchErrors);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateWorkflowYaml(content: string): ValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    return { valid: false, errors: [`Invalid YAML syntax: ${(e as Error).message}`] };
  }

  const workflow = parsed as WorkflowConfig;

  if (!workflow.name) errors.push('name is required');
  if (!workflow.applies_to?.category) errors.push('applies_to.category is required');

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    errors.push('steps must be a non-empty array');
  } else {
    for (const [i, step] of workflow.steps.entries()) {
      const prefix = `steps[${i}]`;
      if (!step.role && !step.match) {
        errors.push(`${prefix} must have either 'role' or 'match'`);
      }
      if (!step.action) {
        errors.push(`${prefix}.action is required`);
      } else if (!['submit', 'review', 'approve'].includes(step.action)) {
        errors.push(`${prefix}.action must be one of: submit, review, approve`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateMatchRule(match: MatchRule, prefix: string): string[] {
  const errors: string[] = [];

  if (match.all === true) return errors;

  if (match.any_of) {
    if (!Array.isArray(match.any_of)) {
      errors.push(`${prefix}.any_of must be an array`);
    } else {
      for (const [i, sub] of match.any_of.entries()) {
        errors.push(...validateMatchRule(sub, `${prefix}.any_of[${i}]`));
      }
    }
  }

  return errors;
}
