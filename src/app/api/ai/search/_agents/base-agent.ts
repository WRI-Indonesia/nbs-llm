/**
 * Base class for all agents in the search pipeline
 * Provides common interface and structure for all agents
 */
export abstract class BaseAgent {
  protected agentName: string

  constructor(agentName: string) {
    this.agentName = agentName
  }

  /**
   * Get the name of this agent
   */
  getName(): string {
    return this.agentName
  }

  /**
   * Abstract method that each agent must implement
   */
  abstract execute(...args: any[]): Promise<any>
}

