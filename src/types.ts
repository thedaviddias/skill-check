export type Severity = 'error' | 'warn';
export type RuleLevel = Severity | 'off';
export type OutputFormat = 'text' | 'json' | 'sarif' | 'html' | 'github';

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
}

export interface RuleFinding {
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
  severity?: Severity;
}

export interface LimitsConfig {
  maxDescriptionChars: number;
  maxBodyLines: number;
  minDescriptionChars: number;
  maxBodyTokens: number;
}

export interface OutputConfig {
  format: OutputFormat;
  reportPath?: string;
}

export interface ResolvedConfig {
  cwd: string;
  configPath?: string;
  roots: string[];
  rootsAbs: string[];
  include: string[];
  exclude: string[];
  limits: LimitsConfig;
  rules: Record<string, RuleLevel>;
  allowlist: string[];
  plugins: string[];
  output: OutputConfig;
  failOnWarning: boolean;
  strictMode: boolean;
  lenientMode: boolean;
}

export interface SkillArtifact {
  id: string;
  category: string;
  slug: string;
  filePath: string;
  relativePath: string;
  content: string;
  body: string;
  frontmatter: Record<string, unknown> | null;
  frontmatterRaw: string | null;
  parseError?: string;
}

export interface RuleContext {
  config: ResolvedConfig;
  resolveRuleLevel: (ruleId: string, fallback: RuleLevel) => RuleLevel;
}

export interface RuleDefinition {
  id: string;
  description: string;
  defaultSeverity: Severity;
  evaluate: (
    skill: SkillArtifact,
    context: RuleContext,
  ) => RuleFinding[] | Promise<RuleFinding[]>;
}

export interface PluginModule {
  rules: RuleDefinition[];
}

export interface Summary {
  skillCount: number;
  errorCount: number;
  warningCount: number;
}

export interface AnalysisResult {
  config: ResolvedConfig;
  skills: SkillArtifact[];
  diagnostics: Diagnostic[];
  summary: Summary;
}

export interface CliOptions {
  configPath?: string;
  format?: OutputFormat;
  strict?: boolean;
  lenient?: boolean;
  maxBodyLines?: number;
  maxDescriptionChars?: number;
  include?: string[];
  exclude?: string[];
  failOnWarning?: boolean;
}
