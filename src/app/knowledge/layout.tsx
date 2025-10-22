import { Metadata } from "next";
import { KnowledgeProvider } from "./_contexts/KnowledgeContext";

export const metadata: Metadata = {
    title: "Knowledge",
    description: "AI experimental of Data Lab Indonesia",
};

export default function KnowledgeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <KnowledgeProvider>
            {children}
        </KnowledgeProvider>
    )
}