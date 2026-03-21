/**
 * git4docs Workflow Engine
 * Interprets workflow YAML to route approvals.
 */

import type {
  WorkflowConfig,
  WorkflowStep,
  CategoryConfig,
  IdentityUser,
  ChangeRequest,
} from '../../shared/types.js';
import { ConfigLoader } from './loader.js';
import { RoleResolver } from './role-resolver.js';

export interface WorkflowResolution {
  workflow: WorkflowConfig;
  steps: ResolvedStep[];
}

export interface ResolvedStep {
  step: WorkflowStep;
  assignees: IdentityUser[];
  stepNumber: number;
}

export class WorkflowEngine {
  constructor(
    private configLoader: ConfigLoader,
    private roleResolver: RoleResolver,
  ) {}

  /**
   * Determine the workflow for a Change Request and resolve all steps.
   */
  async resolveWorkflow(
    docPath: string,
    submitter: IdentityUser,
  ): Promise<WorkflowResolution | null> {
    // Special case: config file changes use system governance
    if (this.configLoader.isConfigPath(docPath)) {
      return this.resolveSystemGovernance(submitter);
    }

    // Get the category from the document path
    const prefix = this.configLoader.getCategoryFromPath(docPath);
    if (!prefix) return null;

    const category = this.configLoader.getCategory(prefix);
    if (!category) return null;

    const workflow = this.configLoader.getWorkflowForCategory(prefix);
    if (!workflow) return null;

    // Resolve each step
    const steps: ResolvedStep[] = [];
    for (const [i, step] of workflow.steps.entries()) {
      const assignees = await this.roleResolver.resolveStepWithFallback(
        step,
        category,
        submitter,
      );
      steps.push({ step, assignees, stepNumber: i });
    }

    return { workflow, steps };
  }

  /**
   * Resolve the system governance workflow (for .git4docs/ changes)
   */
  private async resolveSystemGovernance(
    submitter: IdentityUser,
  ): Promise<WorkflowResolution> {
    const config = this.configLoader.loadConfig();
    const governance = config.system_governance;

    // Create a synthetic category for system governance role resolution
    const workflow: WorkflowConfig = {
      name: 'System Governance',
      description: governance.description,
      applies_to: { category: '_system' },
      steps: governance.steps,
    };

    // For system governance, we resolve roles differently —
    // 'admin' and 'owner' are platform roles, not category roles
    const steps: ResolvedStep[] = governance.steps.map((step, i) => ({
      step,
      assignees: [], // Platform role resolution happens at the API layer
      stepNumber: i,
    }));

    return { workflow, steps };
  }

  /**
   * Get the current step for a Change Request
   */
  getCurrentStep(
    workflow: WorkflowConfig,
    currentStepIndex: number,
  ): WorkflowStep | null {
    if (currentStepIndex >= workflow.steps.length) return null;
    return workflow.steps[currentStepIndex];
  }

  /**
   * Check if the workflow is complete (all steps done)
   */
  isComplete(workflow: WorkflowConfig, currentStepIndex: number): boolean {
    return currentStepIndex >= workflow.steps.length;
  }

  /**
   * Advance to the next step
   */
  getNextStepIndex(workflow: WorkflowConfig, currentStepIndex: number): number {
    return currentStepIndex + 1;
  }
}
