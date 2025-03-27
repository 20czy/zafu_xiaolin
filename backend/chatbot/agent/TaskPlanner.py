import json
import logging
from typing import Dict, Any
from ..LLMService import LLMService
from ..logger_config import setup_logger

logger = setup_logger(__name__)

class TaskPlanner:
    """
    Central planning LLM that decomposes user requests into subtasks
    """

    # system prompt for task planning
    PLANNING_PROMPT = """你是浙江农林大学智能校园系统的中央规划器。你的任务是在校园场景下，分析用户的请求，并将其分解为可处理的子任务。
    
分析用户请求，并以下格式返回任务计划：

{{
  "tasks": [
    {{
      "id": 1,
      "task": "具体任务描述",
      "input": "给该任务的输入",
      "depends_on": []
    }},
    {{
      "id": 2,
      "task": "具体任务描述",
      "input": "给该任务的输入",
      "depends_on": [1]  // 这表示此任务依赖于任务1的结果
    }}
  ],
}}

规则：
1. 每个任务应尽可能精确
2. 如果任务之间有依赖关系，请使用depends_on字段指定
3. 复杂请求应分解为多个子任务
4. 简单请求可以是单个任务

用户请求："{user_request}"
    """
    @classmethod
    def create_task_plan(cls, user_request: str) -> Dict[str, Any]:
        """
        Create a plan for handling the user's request
        
        Args:
            user_request: The user's message
            
        Returns:
            Task plan dictionary
        """
        logger.info("开始创建任务计划")
        logger.debug(f"用户请求: {user_request}")
        
        try:
            # Create planning prompt
            prompt = cls.PLANNING_PROMPT.format(
                user_request=user_request
            )
            logger.debug("已生成规划提示词")

            # Use planning LLM to generate task plan
            logger.info("初始化 LLM 模型")
            llm = LLMService.get_llm(model_name='deepseek-chat', temperature=0.2)

            logger.info("向 LLM 发送请求")
            planning_response = llm.invoke([
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_request}
            ])
            logger.debug("已收到 LLM 响应")

            # Extract JSON from response
            response_text = planning_response.content
            json_match = response_text.strip()
            logger.debug("开始解析 LLM 响应")

            # Parse the plan
            if "```json" in json_match:
                logger.debug("检测到 JSON 代码块，进行提取")
                json_match = json_match.split("```json")[1].split("```")[0]
            
            task_plan = json.loads(json_match)
            logger.info(f"成功生成任务计划，包含 {len(task_plan.get('tasks', []))} 个任务")
            logger.debug(f"任务计划详情: {json.dumps(task_plan, ensure_ascii=False, indent=2)}")
            
            return task_plan

        except json.JSONDecodeError as je:
            logger.error(f"JSON 解析错误: {str(je)}")
            logger.debug(f"导致错误的响应内容: {response_text}")
            return cls._get_fallback_plan(user_request)
        except Exception as e:
            logger.error(f"任务规划过程出错: {str(e)}", exc_info=True)
            return cls._get_fallback_plan(user_request)

    @classmethod
    def _get_fallback_plan(cls, user_request: str) -> Dict[str, Any]:
        """
        生成降级方案
        """
        logger.warning("使用降级方案处理请求")
        return {
            "tasks": [
                {
                    "id": 1,
                    "task": "处理用户请求",
                    "input": user_request,
                    "depends_on": []
                }
            ],
            "final_output_task_id": 1
        }