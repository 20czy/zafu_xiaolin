"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, BrainCircuit, RefreshCw, Server, Wrench } from "lucide-react";

import { apiUrl } from "@/app/chat/util";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CapabilityTool = {
  name: string;
  description?: string;
  source: "mcp-tool";
  server?: string;
  input_schema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
};

type CapabilitySkill = {
  name: string;
  description?: string;
  source: "local-skill";
  location?: string;
  directory?: string;
  has_handler?: boolean;
  resources?: string[];
  metadata?: Record<string, unknown>;
};

type CapabilityResponse = {
  tools: CapabilityTool[];
  skills: CapabilitySkill[];
  summary: {
    tool_count: number;
    skill_count: number;
    error_count: number;
  };
  errors: string[];
};

const emptyCapabilities: CapabilityResponse = {
  tools: [],
  skills: [],
  summary: {
    tool_count: 0,
    skill_count: 0,
    error_count: 0,
  },
  errors: [],
};

function SchemaPreview({ schema }: { schema?: CapabilityTool["input_schema"] }) {
  const properties = schema?.properties || {};
  const required = new Set(schema?.required || []);
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无参数</p>;
  }

  return (
    <div className="mt-3 grid gap-2">
      {entries.map(([name, info]) => (
        <div key={name} className="rounded-md border bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-900">{name}</span>
            {info.type ? <Badge variant="outline">{info.type}</Badge> : null}
            {required.has(name) ? <Badge>必填</Badge> : null}
          </div>
          {info.description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{info.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ToolCard({ tool }: { tool: CapabilityTool }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="break-all text-base leading-6">{tool.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {tool.server || "MCP"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="min-h-10 text-sm leading-6 text-muted-foreground">
          {tool.description || "暂无描述"}
        </p>
        <SchemaPreview schema={tool.input_schema} />
      </CardContent>
    </Card>
  );
}

function SkillCard({ skill }: { skill: CapabilitySkill }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="break-all text-base leading-6">{skill.name}</CardTitle>
          <Badge variant={skill.has_handler ? "secondary" : "outline"} className="shrink-0">
            {skill.has_handler ? "可执行" : "仅激活"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm leading-6 text-muted-foreground">
          {skill.description || "暂无描述"}
        </p>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          {skill.location ? <p className="break-all">位置：{skill.location}</p> : null}
          <p>资源：{skill.resources?.length || 0} 个</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CapabilitiesPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<CapabilityResponse>(emptyCapabilities);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const groupedTools = useMemo(() => {
    return data.tools.reduce<Record<string, CapabilityTool[]>>((groups, tool) => {
      const server = tool.server || "未分组";
      groups[server] = groups[server] || [];
      groups[server].push(tool);
      return groups;
    }, {});
  }, [data.tools]);

  async function loadCapabilities() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/v1/capabilities/"), {
        method: "GET",
        mode: "cors",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`请求失败，状态码：${response.status}`);
      }
      const result = (await response.json()) as CapabilityResponse;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCapabilities();
  }, []);

  return (
    <section className={cn("w-full", className)}>
      <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">当前接入能力</p>
          <h1 className={cn("mt-1 font-semibold tracking-normal text-slate-950", compact ? "text-xl" : "text-2xl")}>
            Tool 与 Skill
          </h1>
        </div>
        <Button onClick={loadCapabilities} disabled={loading} variant="outline">
          <RefreshCw className={loading ? "animate-spin" : ""} />
          刷新
        </Button>
      </div>

      <div className={cn("grid gap-3 py-5", compact ? "grid-cols-3" : "md:grid-cols-3")}>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wrench className="h-4 w-4" />
            MCP Tool
          </div>
          <p className="mt-2 text-3xl font-semibold">{data.summary.tool_count}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrainCircuit className="h-4 w-4" />
            本地 Skill
          </div>
          <p className="mt-2 text-3xl font-semibold">{data.summary.skill_count}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            异常
          </div>
          <p className="mt-2 text-3xl font-semibold">{data.summary.error_count}</p>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {data.errors.length > 0 ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertCircle className="h-4 w-4" />
            部分服务未返回
          </div>
          <div className="space-y-1 text-xs leading-5 text-amber-800">
            {data.errors.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-6", compact ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]")}>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Tool</h2>
          </div>
          {loading ? (
            <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
              正在加载接入的工具...
            </div>
          ) : Object.keys(groupedTools).length === 0 ? (
            <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
              暂未发现 MCP Tool。
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedTools).map(([server, tools]) => (
                <div key={server}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">{server}</Badge>
                    <span className="text-xs text-muted-foreground">{tools.length} 个</span>
                  </div>
                  <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
                    {tools.map((tool) => (
                      <ToolCard key={`${server}-${tool.name}`} tool={tool} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Skill</h2>
          </div>
          {loading ? (
            <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
              正在加载本地技能...
            </div>
          ) : data.skills.length === 0 ? (
            <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
              暂未发现本地 Skill。
            </div>
          ) : (
            <div className="grid gap-3">
              {data.skills.map((skill) => (
                <SkillCard key={skill.name} skill={skill} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
