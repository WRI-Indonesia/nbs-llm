"use client"

import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card } from "@/components/ui/card"
import { PiFileSqlDuotone } from "react-icons/pi";

interface SqlPopoverProps {
    sqlQuery?: string
}

export function SqlPopover({ sqlQuery }: SqlPopoverProps) {
    if (!sqlQuery) return null

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                    <PiFileSqlDuotone className="w-3 h-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[80vh] overflow-y-auto" align="start">
                <div className="space-y-4">
                    {sqlQuery && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-600" />
                                    <h4 className="text-sm font-medium">Generated SQL Query</h4>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(sqlQuery)}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Copy
                                </button>
                            </div>

                            <Card className="p-3 bg-gray-50 rounded-md border overflow-x-auto">
                                <pre className="text-xs text-gray-800 whitespace-pre font-mono leading-relaxed">
                                    <code>{sqlQuery}</code>
                                </pre>
                            </Card>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
