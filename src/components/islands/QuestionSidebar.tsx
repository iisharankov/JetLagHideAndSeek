import { withErrorBoundary } from "@/components/ErrorBoundary";
import { QuestionSidebar as Panel } from "@/components/QuestionSidebar";

export const QuestionSidebar = withErrorBoundary(Panel, "question sidebar");
