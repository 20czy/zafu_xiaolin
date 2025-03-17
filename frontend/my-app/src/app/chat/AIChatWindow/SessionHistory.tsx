// 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import DeleteSessionDialog from "./DeleteSessionDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SessionHistoryProps {
  sessions: Array<{ id: number; title: string; updated_at: string }>;
  currentSessionId: number | null;
  onSessionChange: (id: number) => void;
  onDeleteSession: (id: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SessionHistory({
  sessions,
  currentSessionId,
  onSessionChange,
  onDeleteSession,
  open,
  onOpenChange,
}: SessionHistoryProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle>聊天历史</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full">
          <div className="space-y-2 py-4">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-2 px-2">
                <Button
                  variant={currentSessionId === session.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onSessionChange(session.id)}
                >
                  {session.title}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </span>
                </Button>
                
                <DeleteSessionDialog 
                  onConfirm={() => onDeleteSession(session.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}