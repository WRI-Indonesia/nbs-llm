import { Metadata } from "next";
import { PlaygroundProvider } from "./_contexts/PlaygroundContext";

export const metadata: Metadata = {
    title: "Playground",
    description: "AI experimental of Data Lab Indonesia",
};

export default function PlaygroundLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <PlaygroundProvider>
            {children}
        </PlaygroundProvider>
    )
}