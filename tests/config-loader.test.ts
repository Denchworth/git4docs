/**
 * Config Loader Tests
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ConfigLoader } from '../src/server/config/loader.js';

describe('ConfigLoader', () => {
  const templateDir = path.resolve('templates/general');
  const loader = new ConfigLoader(templateDir);

  describe('loadConfig', () => {
    it('should load root config.yaml', () => {
      const config = loader.loadConfig();
      expect(config.company).toBeDefined();
      expect(config.identity.provider).toBe('manual');
      expect(config.system_governance).toBeDefined();
      expect(config.system_governance.steps.length).toBeGreaterThan(0);
    });
  });

  describe('loadCategories', () => {
    it('should load categories.yaml', () => {
      const { categories } = loader.loadCategories();
      expect(categories.length).toBeGreaterThan(0);

      const pol = categories.find((c) => c.prefix === 'POL');
      expect(pol).toBeDefined();
      expect(pol!.name).toBe('Policy');
      expect(pol!.roles.viewer.match).toEqual({ all: true });
    });
  });

  describe('getCategory', () => {
    it('should find a category by prefix', () => {
      const sop = loader.getCategory('SOP');
      expect(sop).toBeDefined();
      expect(sop!.prefix).toBe('SOP');
      expect(sop!.workflow).toBe('sop-review');
    });

    it('should return undefined for unknown prefix', () => {
      const unknown = loader.getCategory('XXX');
      expect(unknown).toBeUndefined();
    });
  });

  describe('loadWorkflow', () => {
    it('should load a workflow YAML', () => {
      const workflow = loader.loadWorkflow('policies');
      expect(workflow.name).toBe('Policy Approval');
      expect(workflow.applies_to.category).toBe('POL');
      expect(workflow.steps.length).toBeGreaterThan(0);
    });
  });

  describe('getCategoryFromPath', () => {
    it('should extract category from document path', () => {
      expect(loader.getCategoryFromPath('POL/POL-001-test.md')).toBe('POL');
      expect(loader.getCategoryFromPath('SOP/SOP-001-test.md')).toBe('SOP');
    });

    it('should return undefined for unknown category', () => {
      expect(loader.getCategoryFromPath('XXX/XXX-001.md')).toBeUndefined();
    });
  });

  describe('isConfigPath', () => {
    it('should detect config file paths', () => {
      expect(loader.isConfigPath('.git4docs/config.yaml')).toBe(true);
      expect(loader.isConfigPath('.git4docs/workflows/policies.yaml')).toBe(true);
      expect(loader.isConfigPath('POL/POL-001.md')).toBe(false);
    });
  });
});
