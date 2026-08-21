import { redirect } from "next/navigation";

// 편집 화면은 기존 편집기와 완전히 동일한 화면을 그대로 쓴다 — 거기서 "📊 Excel 템플릿"
// 버튼으로 Doc/List Excel 템플릿을 등록한다.
export default async function SimpleFormRedirectPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  redirect(`/editor/${templateId}`);
}
