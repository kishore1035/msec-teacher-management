import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { AIContentType } from '../models/aiGeneratedContent.model';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

export interface AIGenerationRequest {
  contentType: AIContentType;
  systemInstruction: string;
  prompt: string;
  contextData: Record<string, any>;
  parameters: Record<string, any>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AIGenerationResponse {
  provider: string;
  model: string;
  structuredOutput: Record<string, any>;
  rawText: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface IAIProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  generate(request: AIGenerationRequest): Promise<AIGenerationResponse>;
}

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi, label: 'ignore_previous_instructions' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules)/gi, label: 'disregard_instructions' },
  { pattern: /system\s*prompt\s*:/gi, label: 'system_prompt_override' },
  { pattern: /you\s+are\s+now\s+(in\s+)?(developer|jailbreak|unrestricted|admin)\s+mode/gi, label: 'mode_override' },
  { pattern: /override\s+(institutional|security|system|grading)\s+(policy|rules|instructions)/gi, label: 'override_policy' },
  { pattern: /reveal\s+(your\s+)?(api\s*key|secret|system\s*instructions|credentials)/gi, label: 'credential_exfiltration' },
  { pattern: /auto[-_\s]?publish\s+(all\s+)?(exam|results|grades)/gi, label: 'unauthorized_publish_directive' },
];

export class AISecuritySanitizer {
  /**
   * Redacts student personally identifiable information (emails, phone numbers, USNs, roll numbers)
   * before any prompt or context is sent to an AI provider.
   */
  public static redactStudentPII(input: string): string {
    if (!input) return '';
    return input
      // Redact email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
      // Redact Indian & international phone numbers
      .replace(/(?:\+?\d{1,3}[-.\s]?)?\b\d{10}\b/g, '[REDACTED_PHONE]')
      // Redact university seat numbers / roll numbers (e.g., 1MS22CS001, MSEC2024CS101)
      .replace(/\b(?:\d[A-Z]{2}\d{2}[A-Z]{2,3}\d{3}|MSEC\d{4}[A-Z]{2,4}\d{2,4})\b/gi, '[REDACTED_USN]')
      // Redact explicit student name/guardian fields if accidentally serialized
      .replace(/(studentName|guardianName|fatherName|motherName|parentPhone|studentEmail)\s*[:=]\s*["']?[^"',;\n]+["']?/gi, '$1: [REDACTED_PII]');
  }

  /**
   * Sanitizes untrusted text (such as uploaded study material excerpts or user notes)
   * so it is treated strictly as data and cannot override system instructions.
   */
  public static sanitizeUntrustedContext(rawText: string): {
    sanitizedText: string;
    injectionDetected: boolean;
    triggers: string[];
  } {
    if (!rawText) {
      return { sanitizedText: '', injectionDetected: false, triggers: [] };
    }

    const triggers: string[] = [];
    let cleaned = this.redactStudentPII(rawText);

    for (const { pattern, label } of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(cleaned)) {
        triggers.push(label);
        cleaned = cleaned.replace(pattern, '[SANITIZED_UNTURSTED_DIRECTIVE]');
      }
      pattern.lastIndex = 0;
    }

    // Escape delimiter tags if present in input
    cleaned = cleaned
      .replace(/<\/?untrusted_reference_data>/gi, '')
      .trim();

    return {
      sanitizedText: `<untrusted_reference_data>\n${cleaned}\n</untrusted_reference_data>`,
      injectionDetected: triggers.length > 0,
      triggers,
    };
  }

  /**
   * Redacts any potential API keys, Bearer tokens, or secrets from error messages before logging.
   */
  public static redactErrorMessage(message: string): string {
    if (!message) return 'Unknown AI provider error';
    return message
      .replace(/AIza[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  }
}

/**
 * Google Gemini Provider using official @google/genai SDK and gemini-3.8-flash
 */
export class GeminiAIProvider implements IAIProvider {
  public readonly providerName = 'gemini';
  public readonly defaultModel: string;
  private client: GoogleGenAI | null = null;

  constructor(modelName?: string) {
    this.defaultModel = modelName || env.AI_MODEL || 'gemini-3.8-flash';
  }

  private getClient(): GoogleGenAI {
    if (!env.GEMINI_API_KEY) {
      throw new ApiError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        'Gemini API key is not configured on the server'
      );
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
    }
    return this.client;
  }

  public async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const ai = this.getClient();

    const response = await ai.models.generateContent({
      model: this.defaultModel,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let structuredOutput: Record<string, any>;
    try {
      structuredOutput = JSON.parse(rawText);
    } catch {
      structuredOutput = {
        content: rawText,
        format: 'markdown',
      };
    }

    const promptTokens =
      (response as any).usageMetadata?.promptTokenCount ||
      Math.max(10, Math.ceil(request.prompt.length / 4));
    const completionTokens =
      (response as any).usageMetadata?.candidatesTokenCount ||
      Math.max(20, Math.ceil(rawText.length / 4));

    return {
      provider: this.providerName,
      model: this.defaultModel,
      structuredOutput,
      rawText,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Deterministic Institutional Academic Provider (used when external API key is not set
 * in test/development environments or when fallback provider is selected).
 */
export class DeterministicAcademicAIProvider implements IAIProvider {
  public readonly providerName = 'gemini-compatible-academic-engine';
  public readonly defaultModel: string;

  constructor(modelName?: string) {
    this.defaultModel = modelName || env.AI_MODEL || 'gemini-3.8-flash';
  }

  public async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const { contentType, parameters, contextData } = request;
    const subjectName = contextData.subjectName || 'Academic Subject';
    const subjectCode = contextData.subjectCode || 'SUB101';
    const topic = parameters.topic || contextData.topic || 'Core Curriculum Topic';
    const difficulty = parameters.difficultyLevel || 'intermediate';
    const subtopics: string[] = Array.isArray(parameters.subtopics) && parameters.subtopics.length > 0
      ? parameters.subtopics
      : [`Fundamentals of ${topic}`, `Analytical Methods in ${topic}`, `Practical Applications of ${topic}`];

    let structuredOutput: Record<string, any> = {};

    switch (contentType) {
      case 'lesson_plan': {
        const duration = Number(parameters.durationMinutes || 60);
        const sessions = Number(parameters.numberOfSessions || 1);
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic,
          difficultyLevel: difficulty,
          durationMinutes: duration,
          numberOfSessions: sessions,
          teachingMethodology: parameters.teachingMethodology || 'Interactive Lecture & Guided Problem Solving',
          learningObjectives: parameters.learningObjectives || [
            `Understand the foundational principles of ${topic}`,
            `Analyze real-world engineering and academic scenarios using ${topic}`,
            `Apply problem-solving techniques to evaluate ${topic} use cases`,
          ],
          prerequisites: [`Foundational concepts in ${subjectName}`],
          sessionBreakdown: Array.from({ length: sessions }, (_, idx) => ({
            sessionNumber: idx + 1,
            title: `Session ${idx + 1}: ${subtopics[idx % subtopics.length]}`,
            timeline: [
              { segment: 'Introduction & Hook', minutes: Math.round(duration * 0.15), activity: `Overview of ${topic} and connection to prior lectures` },
              { segment: 'Core Concept Delivery', minutes: Math.round(duration * 0.45), activity: `Detailed walkthrough of ${subtopics[idx % subtopics.length]} with visual diagrams` },
              { segment: 'Guided Practice & Discussion', minutes: Math.round(duration * 0.25), activity: 'Collaborative problem solving and formative check' },
              { segment: 'Summary & Exit Ticket', minutes: Math.round(duration * 0.15), activity: 'Recap of key takeaways and Q&A' },
            ],
          })),
          assessmentStrategy: 'Formative in-class polling, short analytical exercise, and follow-up assignment',
          recommendedReadings: (contextData.referenceMaterials || []).map((m: any) => m.title),
        };
        break;
      }

      case 'quiz': {
        const count = Number(parameters.questionCount || 5);
        const totalMarks = Number(parameters.totalMarks || count * 2);
        const marksPerQ = Number((totalMarks / count).toFixed(1));
        const qTypes: string[] = parameters.questionTypes || ['mcq'];
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic,
          difficultyLevel: difficulty,
          durationMinutes: Number(parameters.durationMinutes || 30),
          totalMarks,
          questions: Array.from({ length: count }, (_, idx) => {
            const qType = qTypes[idx % qTypes.length] || 'mcq';
            const subtopic = subtopics[idx % subtopics.length];
            return {
              questionNumber: idx + 1,
              questionType: qType,
              bloomLevel: (parameters.bloomTaxonomyLevels || ['understand', 'apply', 'analyze'])[idx % 3],
              marks: marksPerQ,
              questionText: `(${subjectCode})Regarding ${subtopic} in ${topic}, which of the following statements or analytical derivations best characterizes Step ${idx + 1}?`,
              options:
                qType === 'mcq'
                  ? [
                      `A) Primary principle of ${subtopic} under standard invariants`,
                      `B) Secondary approximation ignoring boundary conditions`,
                      `C) Inverse relation applicable only in degenerate cases`,
                      `D) Unrelated empirical observation`,
                    ]
                  : qType === 'true_false'
                  ? ['True', 'False']
                  : undefined,
              correctAnswer:
                parameters.includeAnswerKey !== false
                  ? qType === 'mcq'
                    ? `A) Primary principle of ${subtopic} under standard invariants`
                    : qType === 'true_false'
                    ? 'True'
                    : `Expected analytical explanation covering ${subtopic} in ${topic}.`
                  : undefined,
              explanation:
                parameters.includeAnswerKey !== false
                  ? `Derived from core institutional curriculum principles for ${topic} (${subtopic}).`
                  : undefined,
            };
          }),
        };
        break;
      }

      case 'question_paper': {
        const totalMarks = Number(parameters.totalMarks || 100);
        const sectionsConfig = parameters.sectionsConfig || [
          { sectionName: 'Part A - Short Answer Questions', questionCount: 5, marksPerQuestion: 4, questionType: 'short_answer', optionalChoices: 0 },
          { sectionName: 'Part B - Analytical & Problem Solving', questionCount: 5, marksPerQuestion: 16, questionType: 'long_answer', optionalChoices: 1 },
        ];
        structuredOutput = {
          institution: 'MSEC Academic Examination Draft',
          examTitle: parameters.examTitle || `${subjectName} - ${parameters.examType || 'Internal Assessment'} Draft`,
          subject: `${subjectName} (${subjectCode})`,
          topicCoverage: [topic, ...subtopics],
          examType: parameters.examType || 'internal_1',
          durationMinutes: Number(parameters.durationMinutes || 180),
          totalMarks,
          generalInstructions: [
            'Answer all questions in Part A.',
            'Show complete step-by-step analytical derivations where applicable.',
            'Missing data, if any, may be suitably assumed and stated clearly.',
          ],
          sections: sectionsConfig.map((sec: any, sIdx: number) => ({
            sectionName: sec.sectionName,
            questionType: sec.questionType,
            marksPerQuestion: sec.marksPerQuestion,
            optionalChoices: sec.optionalChoices || 0,
            questions: Array.from({ length: sec.questionCount }, (_, qIdx) => ({
              questionNumber: `${String.fromCharCode(65 + sIdx)}${qIdx + 1}`,
              questionText: `Analyze and evaluate ${subtopics[(sIdx + qIdx) % subtopics.length]} in the context of ${topic}.`,
              marks: sec.marksPerQuestion,
              bloomLevel: qIdx % 2 === 0 ? 'apply' : 'analyze',
              courseOutcome: `CO${((sIdx + qIdx) % 4) + 1}`,
              markingScheme:
                parameters.includeMarkingScheme !== false
                  ? `Concept definition: ${Math.ceil(sec.marksPerQuestion * 0.3)}M | Derivation/Application: ${Math.floor(sec.marksPerQuestion * 0.7)}M`
                  : undefined,
            })),
          })),
        };
        break;
      }

      case 'assignment': {
        const qCount = Number(parameters.questionCount || 5);
        const totalMarks = Number(parameters.totalMarks || 50);
        const perMark = Number((totalMarks / qCount).toFixed(1));
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic,
          assignmentType: parameters.assignmentType || 'problem_set',
          difficultyLevel: difficulty,
          totalMarks,
          estimatedHours: Number(parameters.estimatedHours || 4),
          submissionGuidelines: [
            'Submit original work with complete derivations/code before the deadline.',
            'Cite any institutional study materials or textbook references used.',
          ],
          questions: Array.from({ length: qCount }, (_, idx) => ({
            questionNumber: idx + 1,
            title: `Problem ${idx + 1}: ${subtopics[idx % subtopics.length]}`,
            prompt: `Design, formulate, and solve a practical scenario demonstrating ${subtopics[idx % subtopics.length]} within ${topic}.`,
            marks: perMark,
            deliverables: ['Analytical formulation', 'Step-by-step verification', 'Conclusion & interpretation'],
          })),
          evaluationRubric:
            parameters.includeEvaluationRubric !== false
              ? [
                  { criterion: 'Conceptual Accuracy', weightPercentage: 40 },
                  { criterion: 'Methodology & Completeness', weightPercentage: 40 },
                  { criterion: 'Clarity & Presentation', weightPercentage: 20 },
                ]
              : undefined,
        };
        break;
      }

      case 'topic_explanation': {
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic,
          targetAudienceLevel: parameters.targetAudienceLevel || 'undergraduate',
          executiveOverview: `${topic} is a foundational pillar of ${subjectName} that enables systematic analysis and design across core subtopics (${subtopics.join(', ')}).`,
          detailedConceptBreakdown: subtopics.map((st, i) => ({
            order: i + 1,
            subtopic: st,
            explanation: `In-depth explanation of ${st}, highlighting theoretical invariants, governing relationships, and operational boundaries.`,
            keyTakeaway: `Mastery of ${st} ensures accurate modeling in ${topic}.`,
          })),
          workedExamples:
            parameters.includeExamples !== false
              ? [
                  {
                    title: `Worked Example 1: Applying ${subtopics[0]}`,
                    problemStatement: `Given a standard system governed by ${topic}, determine the response across ${subtopics[0]}.`,
                    stepByStepSolution: [
                      'Step 1: Identify boundary conditions and known parameters.',
                      `Step 2: Apply the governing relationship of ${subtopics[0]}.`,
                      'Step 3: Validate the result against institutional domain constraints.',
                    ],
                  },
                ]
              : [],
          realWorldApplications:
            parameters.includeRealWorldApplications !== false
              ? [
                  `Industrial and academic deployment of ${topic} in high-reliability systems`,
                  `Optimization of ${subtopics[0]} in modern engineering workflows`,
                ]
              : [],
          commonMisconceptions:
            parameters.includeCommonMisconceptions !== false
              ? [
                  {
                    misconception: `Assuming ${subtopics[0]} holds linearly without verifying preconditions.`,
                    correction: `Always verify domain invariants of ${topic} prior to applying simplified formulas.`,
                  },
                ]
              : [],
          practiceQuestions:
            parameters.includePracticeQuestions !== false
              ? [
                  `Explain how ${subtopics[0]} interacts with ${subtopics[1 % subtopics.length]} in ${topic}.`,
                  `Derive the primary operational criterion for ${topic}.`,
                ]
              : [],
        };
        break;
      }

      case 'rubric': {
        const totalMarks = Number(parameters.totalMarks || 100);
        const criteria: string[] =
          Array.isArray(parameters.criteriaList) && parameters.criteriaList.length > 0
            ? parameters.criteriaList
            : [
                'Domain Knowledge & Theoretical Understanding',
                'Analytical Execution & Problem Solving',
                'Technical Implementation & Validation',
                'Documentation & Presentation Clarity',
              ];
        const levels: string[] = parameters.performanceLevels || [
          'Exemplary',
          'Proficient',
          'Developing',
          'Needs Improvement',
        ];
        const weightPerCriterion = Number((totalMarks / criteria.length).toFixed(2));

        structuredOutput = {
          assessmentTitle: parameters.assessmentTitle || `${topic} Assessment Rubric`,
          subject: `${subjectName} (${subjectCode})`,
          topic,
          totalMarks,
          performanceLevels: levels,
          criteriaMatrix: criteria.map((criterion, idx) => ({
            criterionNumber: idx + 1,
            criterion,
            maxMarks: weightPerCriterion,
            descriptors: levels.map((lvl, lIdx) => ({
              level: lvl,
              scoreRange: `${Math.max(0, Math.round(weightPerCriterion * (1 - (lIdx + 1) * 0.25)))} - ${Math.round(weightPerCriterion * (1 - lIdx * 0.25))}`,
              description: `${lvl} demonstration of ${criterion.toLowerCase()} in ${topic}.`,
            })),
          })),
        };
        break;
      }

      case 'study_material_summary': {
        const refTitles = (contextData.referenceMaterials || []).map((m: any) => m.title);
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic: topic || refTitles[0] || 'Study Material Summary',
          summaryFormat: parameters.summaryFormat || 'structured_notes',
          sourceMaterialsReferenced: refTitles,
          executiveSummary: `Concise academic synthesis of ${topic} covering ${subtopics.join(', ')}.`,
          keyConcepts: subtopics.map((st) => ({
            concept: st,
            summary: `Core definition, governing principles, and analytical importance of ${st}.`,
          })),
          keyFormulasAndTerms:
            parameters.includeKeyFormulasAndTerms !== false
              ? [
                  { term: topic, definition: `Primary domain framework within ${subjectName}.` },
                  { term: subtopics[0], definition: `Foundational analytical unit of ${topic}.` },
                ]
              : [],
          revisionQuestions:
            parameters.includeRevisionQuestions !== false
              ? [
                  `Summarize the core pillars of ${topic}.`,
                  `How do the reference study materials connect ${subtopics[0]} to practical applications?`,
                ]
              : [],
        };
        break;
      }

      case 'teaching_material':
      case 'learning_outcomes':
      case 'question_bank':
      default: {
        structuredOutput = {
          subject: `${subjectName} (${subjectCode})`,
          topic,
          contentType,
          difficultyLevel: difficulty,
          sections: subtopics.map((st, idx) => ({
            order: idx + 1,
            heading: st,
            body: `Comprehensive instructional content and academic outcomes for ${st} in ${topic}.`,
          })),
          outcomes: [
            `CO1: Articulate the theoretical foundations of ${topic}`,
            `CO2: Formulate analytical solutions across ${subtopics.join(', ')}`,
            `CO3: Evaluate complex engineering/academic systems using ${topic}`,
          ],
        };
        break;
      }
    }

    const rawText = JSON.stringify(structuredOutput, null, 2);
    const promptTokens = Math.max(25, Math.ceil(request.prompt.length / 4));
    const completionTokens = Math.max(40, Math.ceil(rawText.length / 4));

    return {
      provider: this.providerName,
      model: this.defaultModel,
      structuredOutput,
      rawText,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      durationMs: Math.max(1, Date.now() - startTime),
    };
  }
}

export class AIProviderRegistry {
  private static customProvider: IAIProvider | null = null;

  /**
   * Allows tests or runtime configuration to inject a custom IAIProvider implementation
   * without touching business logic.
   */
  public static setCustomProvider(provider: IAIProvider | null): void {
    this.customProvider = provider;
  }

  public static getCustomProvider(): IAIProvider | null {
    return this.customProvider;
  }

  public static resolveProvider(): IAIProvider {
    if (this.customProvider) {
      return this.customProvider;
    }

    if (env.AI_PROVIDER === 'fallback' || !env.GEMINI_API_KEY) {
      return new DeterministicAcademicAIProvider(env.AI_MODEL);
    }

    return new GeminiAIProvider(env.AI_MODEL);
  }

  /**
   * Executes an AI generation request with configurable timeout and exponential backoff retry logic.
   */
  public static async executeWithResilience(
    request: AIGenerationRequest
  ): Promise<AIGenerationResponse> {
    const provider = this.resolveProvider();
    const timeoutMs = request.timeoutMs ?? env.AI_REQUEST_TIMEOUT_MS ?? 15000;
    const maxRetries = request.maxRetries ?? env.AI_MAX_RETRIES ?? 2;

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt += 1;
      try {
        const result = await this.runWithTimeout(provider.generate(request), timeoutMs);
        return result;
      } catch (err: any) {
        lastError = err;
        const isTransient = this.isRetryableError(err);
        logger.warn(
          `[AIProvider:${provider.providerName}] Attempt ${attempt}/${maxRetries + 1} failed: ${AISecuritySanitizer.redactErrorMessage(err?.message || 'Unknown error')} (retryable=${isTransient})`
        );

        if (!isTransient || attempt > maxRetries) {
          break;
        }

        // Exponential backoff (e.g., 50ms, 100ms in test; 250ms, 500ms in prod)
        const baseDelay = env.NODE_ENV === 'test' ? 30 : 200;
        const backoffMs = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    const sanitizedMsg = AISecuritySanitizer.redactErrorMessage(
      lastError?.message || 'AI provider failed to process request'
    );
    const errCode = (lastError?.code || lastError?.status || '').toString().toUpperCase();

    if (errCode.includes('TIMEOUT') || sanitizedMsg.toLowerCase().includes('timed out')) {
      const timeoutErr = new ApiError(
        HTTP_STATUS.GATEWAY_TIMEOUT || 504,
        `AI provider request timed out after ${timeoutMs}ms`
      );
      (timeoutErr as any).errorCategory = 'PROVIDER_TIMEOUT';
      throw timeoutErr;
    }

    if (
      lastError?.statusCode === 429 ||
      errCode.includes('429') ||
      errCode.includes('RATE_LIMIT') ||
      sanitizedMsg.toLowerCase().includes('rate limit') ||
      sanitizedMsg.toLowerCase().includes('quota')
    ) {
      const rateErr = new ApiError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        `AI provider rate limit exceeded: ${sanitizedMsg}`
      );
      (rateErr as any).errorCategory = 'PROVIDER_RATE_LIMIT';
      throw rateErr;
    }

    const providerErr = new ApiError(
      HTTP_STATUS.BAD_GATEWAY || 502,
      `AI provider error: ${sanitizedMsg}`
    );
    (providerErr as any).errorCategory = 'PROVIDER_ERROR';
    throw providerErr;
  }

  private static runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(`AI generation request timed out after ${timeoutMs}ms`);
        (err as any).code = 'ETIMEDOUT';
        reject(err);
      }, timeoutMs);

      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private static isRetryableError(err: any): boolean {
    if (!err) return false;
    const code = (err.code || err.status || '').toString().toUpperCase();
    const msg = (err.message || '').toLowerCase();

    if (err.retryable === true) return true;
    if (err.retryable === false) return false;

    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === '503' ||
      code === '502' ||
      msg.includes('timed out') ||
      msg.includes('temporary') ||
      msg.includes('unavailable') ||
      msg.includes('overloaded') ||
      msg.includes('network error')
    ) {
      return true;
    }

    return false;
  }
}
