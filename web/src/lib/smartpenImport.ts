// 스마트펜 데이터 가져오기는 사용자가 이후 SDK/참고 repo를 제공하면 그걸 붙이는 것을
// 전제로 인터페이스만 먼저 만든다. 지금은 전달받은 이미지 참조를 그대로 통과시키는
// 스텁 구현체만 둔다. PRD_폼솔루션 §7.7.5의 FormDetectionProvider/HandwritingOcrProvider
// 추상화와 같은 패턴.

export type SmartpenImportInput = {
  pageImages: string[];
};

export type SmartpenImportResult = {
  pageImages: string[];
};

export interface SmartpenImportProvider {
  importHandwriting(documentId: string, input: SmartpenImportInput): Promise<SmartpenImportResult>;
}

class StubSmartpenImportProvider implements SmartpenImportProvider {
  async importHandwriting(_documentId: string, input: SmartpenImportInput): Promise<SmartpenImportResult> {
    return { pageImages: input.pageImages };
  }
}

export const smartpenImportProvider: SmartpenImportProvider = new StubSmartpenImportProvider();
