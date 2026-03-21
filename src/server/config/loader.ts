/**
 * git4docs Config Loader
 * Reads YAML configuration from the company's git repo.
 * Config lives in .git4docs/ — versioned and change-controlled.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type {
  CompanyConfig,
  CategoriesConfig,
  CategoryConfig,
  WorkflowConfig,
  PdfTemplateConfig,
} from '../../shared/types.js';
import { DEFAULT_PDF_TEMPLATE } from '../../shared/types.js';

export class ConfigLoader {
  private configDir: string;

  constructor(repoDir: string) {
    this.configDir = path.join(repoDir, '.git4docs');
  }

  /**
   * Load the root config.yaml
   */
  loadConfig(): CompanyConfig {
    const configPath = path.join(this.configDir, 'config.yaml');
    const content = fs.readFileSync(configPath, 'utf-8');
    return yaml.load(content) as CompanyConfig;
  }

  /**
   * Load categories.yaml
   */
  loadCategories(): CategoriesConfig {
    const categoriesPath = path.join(this.configDir, 'categories.yaml');
    const content = fs.readFileSync(categoriesPath, 'utf-8');
    return yaml.load(content) as CategoriesConfig;
  }

  /**
   * Get a specific category config by prefix
   */
  getCategory(prefix: string): CategoryConfig | undefined {
    const { categories } = this.loadCategories();
    return categories.find((c) => c.prefix === prefix);
  }

  /**
   * Load a specific workflow YAML
   */
  loadWorkflow(workflowName: string): WorkflowConfig {
    const workflowPath = path.join(
      this.configDir,
      'workflows',
      `${workflowName}.yaml`,
    );
    const content = fs.readFileSync(workflowPath, 'utf-8');
    return yaml.load(content) as WorkflowConfig;
  }

  /**
   * Get the workflow for a document category
   */
  getWorkflowForCategory(prefix: string): WorkflowConfig | undefined {
    const category = this.getCategory(prefix);
    if (!category) return undefined;
    return this.loadWorkflow(category.workflow);
  }

  /**
   * List all available workflows
   */
  listWorkflows(): string[] {
    const workflowDir = path.join(this.configDir, 'workflows');
    if (!fs.existsSync(workflowDir)) return [];

    return fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace('.yaml', ''));
  }

  /**
   * Get the category prefix from a document path
   * e.g., "POL/POL-001-info-security.md" → "POL"
   */
  getCategoryFromPath(docPath: string): string | undefined {
    const parts = docPath.split('/');
    if (parts.length < 2) return undefined;

    const prefix = parts[0];
    const category = this.getCategory(prefix);
    return category ? prefix : undefined;
  }

  /**
   * Load PDF template config from config.yaml.
   * Falls back to defaults if not present.
   */
  loadPdfTemplates(): PdfTemplateConfig {
    try {
      const config = this.loadConfig() as any;
      if (config.pdf_templates) {
        return {
          ...DEFAULT_PDF_TEMPLATE,
          ...config.pdf_templates,
          margins: {
            ...DEFAULT_PDF_TEMPLATE.margins,
            ...(config.pdf_templates.margins || {}),
          },
        };
      }
    } catch {
      // Config file might not exist yet
    }
    return { ...DEFAULT_PDF_TEMPLATE };
  }

  /**
   * Save PDF template config into config.yaml.
   * Merges with existing config.
   */
  savePdfTemplates(templates: PdfTemplateConfig): string {
    const configPath = path.join(this.configDir, 'config.yaml');
    let config: any = {};
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = yaml.load(content) || {};
    } catch {
      // Start fresh
    }

    config.pdf_templates = {
      header_html: templates.header_html,
      footer_html: templates.footer_html,
      page_size: templates.page_size,
      margins: templates.margins,
      ...(templates.logo_path ? { logo_path: templates.logo_path } : {}),
    };

    const yamlContent =
      '# .git4docs/config.yaml\n' +
      '# Company-level settings and meta-governance.\n\n' +
      yaml.dump(config, { lineWidth: 120, noRefs: true });

    fs.writeFileSync(configPath, yamlContent, 'utf-8');
    return yamlContent;
  }

  /**
   * Check if a path is a config file (inside .git4docs/)
   */
  isConfigPath(docPath: string): boolean {
    return docPath.startsWith('.git4docs/');
  }
}
