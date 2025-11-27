import { useState } from "react";

const AGENT_NAME_KEY = "agentName";

/**
 * Validate and sanitize agent name to be a single word
 * Removes spaces and special characters, keeping only letters and numbers
 */
export const sanitizeAgentName = (name: string): string => {
  // Remove spaces and keep only alphanumeric characters
  return name.replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Check if an agent name is valid (single word, non-empty)
 */
export const isValidAgentName = (name: string): boolean => {
  const sanitized = sanitizeAgentName(name);
  return sanitized.length > 0 && !name.includes(' ');
};

export const getAgentName = (): string => {
  return localStorage.getItem(AGENT_NAME_KEY) || "Agent";
};

export const setAgentName = (name: string): void => {
  // Sanitize before saving
  const sanitized = sanitizeAgentName(name);
  localStorage.setItem(AGENT_NAME_KEY, sanitized || "Agent");
};

export const clearAgentName = (): void => {
  localStorage.removeItem(AGENT_NAME_KEY);
};

export const useAgentName = () => {
  const [agentName, setAgentNameState] = useState<string>(getAgentName());

  const updateAgentName = (name: string) => {
    setAgentName(name);
    setAgentNameState(name);
  };

  return { agentName, setAgentName: updateAgentName };
};
