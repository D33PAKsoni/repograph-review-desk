export type ArtifactKind = 'fixture' | 'generated';
export interface Repository { id: string; name: string; url: string; commitSha: string }
export interface Tool { name: 'repograph' | 'graphify'; version: string; mode: string }
export interface Metadata { repository: Repository; artifactKind: ArtifactKind; generatedAt: string; tools: Tool[] }
export interface Scenario { id: string; title: string; changedFiles: string[] }
export interface Catalog extends Metadata { cases: Scenario[] }
export interface Citation { evidenceIds: string[] }
export interface ImpactEntry extends Citation { path: string }
export interface Evidence {
  id: string; producer: 'repograph' | 'graphify'; confidence: string; relation: string;
  path: string; startLine: number; endLine: number; excerpt: string; sourceUrl: string | null;
}
export interface ReviewCase extends Scenario {
  scenarioType: 'file-impact';
  impact: { directDependents: ImpactEntry[]; transitiveDependents: ImpactEntry[]; relatedTests: ImpactEntry[]; blindSpots: string[] };
  architecture: { summary: string; contextText: string; evidenceIds: string[] };
  evidence: Evidence[]; limitations: string[];
}
export interface CaseResponse extends Metadata { case: ReviewCase }
export interface Briefing {
  schemaVersion: '1.0.0'; artifactKind: ArtifactKind; repositoryId: string; commitSha: string;
  caseId: string; mode: 'fixture' | 'live'; model: string | null; summary: string;
  findings: (Citation & { text: string })[]; reviewChecklist: (Citation & { text: string })[];
  limitations: string[]; generatedAt: string; markdown: string;
}
export interface Health { status: 'ok'; apiMode: 'mock' | 'service'; aiMode: 'fixture' | 'live'; artifactKind: ArtifactKind; gemmaConfigured: boolean }
