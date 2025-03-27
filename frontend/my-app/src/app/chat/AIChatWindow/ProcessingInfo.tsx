// ProcessingInfo.tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Clock, Workflow,  Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProcessingInfoProps {
  processingSteps: string[];
  taskPlan: any[];
  toolSelections: Record<string, any>;
  taskResults: Record<string, any>;
  isProcessing: boolean;
}

export default function ProcessingInfo({
  processingSteps,
  taskPlan,
  toolSelections,
  taskResults,
  isProcessing
}: ProcessingInfoProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="mb-3 overflow-hidden border-dashed">
      <div className="p-2 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className="text-sm font-medium">处理过程</span>
        </div>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? '隐藏详情' : '显示详情'}
        </button>
      </div>
      
      {expanded && (
        <div className="p-3">
          <ProcessingSteps steps={processingSteps} isProcessing={isProcessing} />
          
          {taskPlan.length > 0 && (
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="tasks">
                <AccordionTrigger className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    <span>任务计划</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {taskPlan.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <TaskPlanDisplay tasks={taskPlan} toolSelections={toolSelections} taskResults={taskResults} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </Card>
  );
}

function ProcessingSteps({ steps, isProcessing }: { steps: string[], isProcessing: boolean }) {
    // console.log('ProcessingSteps', steps, isProcessing);
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground mb-2">处理步骤</h4>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{step}</span>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>处理中...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskPlanDisplay({ 
  tasks, 
  toolSelections, 
  taskResults 
}: { 
  tasks: any[], 
  toolSelections: Record<string, any>,
  taskResults: Record<string, any>
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const taskId = task.id;
        const toolSelection = toolSelections[taskId];
        const taskResult = taskResults[taskId];
        
        return (
          <div key={taskId} className="border rounded-md p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-sm">{task.task}</div>
              <TaskStatusBadge task={task} taskResult={taskResult} />
            </div>
            
            {toolSelection && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                {/* <Tool className="h-3 w-3" /> */}
                <span>使用工具: {toolSelection.tool}</span>
              </div>
            )}
            
            {taskResult && taskResult.status === "success" && taskResult.api_result && (
              <div className="mt-2 text-xs bg-muted/50 p-2 rounded max-h-24 overflow-y-auto">
                <ResultPreview result={taskResult.api_result} />
              </div>
            )}
            
            {taskResult && taskResult.status === "error" && (
              <div className="mt-2 text-xs text-destructive p-2 rounded border border-destructive/20 bg-destructive/10">
                {taskResult.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskStatusBadge({ task, taskResult }: { task: any, taskResult?: any }) {
  if (!taskResult) {
    return (
      <Badge variant="outline" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        等待中
      </Badge>
    );
  }
  
  if (taskResult.status === "success") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600/20 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        完成
      </Badge>
    );
  }
  
  if (taskResult.status === "error") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              错误
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {taskResult.error}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (taskResult.status === "skipped") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-600/20 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              已跳过
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {taskResult.reason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return null;
}

function ResultPreview({ result }: { result: any }) {
  if (typeof result === 'string') {
    return <span>{result.length > 200 ? result.substring(0, 200) + '...' : result}</span>;
  }
  
  if (Array.isArray(result)) {
    return <span>{result.length} 条结果</span>;
  }
  
  if (typeof result === 'object') {
    return <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>;
  }
  
  return <span>{String(result)}</span>;
}
