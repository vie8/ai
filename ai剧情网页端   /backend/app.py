from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import os
from dotenv import load_dotenv
from openai import OpenAI
import json

# 获取当前文件的目录
current_dir = os.path.dirname(os.path.abspath(__file__))
# 获取项目根目录
root_dir = os.path.dirname(current_dir)
# 前端文件夹路径
frontend_dir = os.path.join(root_dir, 'frontend')

app = Flask(__name__, static_folder=frontend_dir, static_url_path='/frontend')
CORS(app)
load_dotenv()

# 初始化OpenAI客户端
client = OpenAI(
    api_key=os.getenv('AI_MODEL_KEY'),
    base_url=os.getenv('AI_MODEL_ENDPOINT')
)

# 修改对话历史存储的结构
chat_histories = {}

# 添加根路由来提供前端页面
@app.route('/')
def index():
    try:
        return send_from_directory(frontend_dir, 'index.html')
    except Exception as e:
        print(f"Error serving index.html: {str(e)}")
        return str(e), 500

# 添加静态文件路由
@app.route('/<path:path>')
def serve_static(path):
    try:
        return send_from_directory(frontend_dir, path)
    except Exception as e:
        print(f"Error serving static file {path}: {str(e)}")
        return str(e), 404

# 添加图片文件的专门路由（如果需要）
@app.route('/frontend/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(frontend_dir, 'images'), filename)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        print("Received request data:", data)
        user_message = data.get('message', '')
        session_id = data.get('sessionId', 'default')
        event_context = data.get('eventContext', '')
        is_initial = data.get('isInitial', False)  # 检查是否是初始消息

        # 获取或创建该会话的历史记录
        if session_id not in chat_histories or is_initial:
            chat_histories[session_id] = {
                'messages': [],
                'summary': '',
                'player_status': {
                    'role': '',
                    'major_decisions': [],
                    'assets': [],
                    'relationships': []
                }
            }
            # 如果是新会话或初始消息，返回开场白
            welcome_message = """欢迎来到15世纪的佛罗伦萨！ 👋
你站在熙熙攘攘的街头，周围是古老的建筑和忙碌的商贩。你是一个初来乍到的冒险者，需要在这里建立自己的声望和财富。

💰金钱：100，⭐声望：0

你可以：
1. 成为一名商人，经营店铺，努力成为富甲一方的豪绅
2. 当一名雇佣兵，提供护卫服务，争取成为光荣的骑士
3. 加入地下帮派，赚取黑金，以反抗贵族
4. 成为一名寻宝者，探索充满宝藏的危机之境
4. 或者...告诉我你想以什么角色开始游戏？"""
            
            def generate_welcome():
                yield f"data: {json.dumps({'content': welcome_message})}\n\n"
            
            return Response(generate_welcome(), mimetype='text/event-stream')

        history = chat_histories[session_id]
        
        # 如果有事件上下文，先添加到历史记录中
        if event_context:
            print("Adding event context:", event_context)  # 添加事件上下文日志
            history['messages'].append({"role": "system", "content": event_context})
        
        # 添加用户消息到历史记录
        history['messages'].append({"role": "user", "content": user_message})

        def generate():
            try:
                # 构建完整的消息历史，包含摘要信息
                messages = [
                    {"role": "system", "content": f"""你是一个中世纪佛罗伦萨的游戏管理员。游戏背景设定在15世纪的佛罗伦萨，这里不仅有骑士团与刺客的斗争、地下帮派与贵族的对抗，还有吸血鬼、怪兽等神秘事件。

当前游戏状态：
{history['summary']}

玩家角色：{history['player_status']['role']}
重要决策：{', '.join(history['player_status']['major_decisions'])}
拥有资产：{', '.join(history['player_status']['assets'])}
NPC关系：{', '.join(history['player_status']['relationships'])}

你需要：
1. 根据玩家的选择和行动生成有趣的事件和结果
2. 每次回复都要提供2-3个可能的选择自动换行显示给玩家
3. 回复要简短有趣，富有中世纪佛罗伦萨特色
4. 通过 [系统] 特殊标记来显示金钱和声望的变化
5. 记住玩家的身份和之前的选择，保持剧情连贯性
6. 适时制造一些随机事件来增加游戏的不确定性
7. 每条信息都显示金钱与声望值，但只显示一次，避免出现重复显示（例如：💰金钱：1000，⭐️声望：100）
8. 根据上下文实时变化金钱与声望值
9. 将用户的输入与金钱与声望值进行结合，合理的生成事件（例如：玩家选择购买材料，则金钱减少。家打算招兵买马，因声望值过低，则无法成功）
10.根据用户的游玩程度逐渐解锁更多的探索内容，逐步铺开游戏庞大的世界观，避免一开始就让玩家"出入自如"。（例如：玩家一开始无法直接拜访贵族，需要通过做生意或与击败坏人获取金钱或声望，才能拜访贵族，并解锁更庞大的世界关系）
11.游戏中会出现吸血鬼、怪兽、骑士团、刺客、地下帮派、贵族、寻宝探险等元素，并且会出现叛变、圈套、诡计、阴谋等事件，玩家需要根据情况做出选择，并承担后果。

注意：保持回复简短，每次回复控制在100字以内。（并适当添加emoji表情）"""}
                ] + history['messages']

                print("Sending messages to AI:", messages)  # 添加消息日志

                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=messages,
                    stream=True
                )
                
                current_response = ""
                for chunk in response:
                    if hasattr(chunk.choices[0].delta, 'content'):
                        content = chunk.choices[0].delta.content
                        if content:
                            current_response += content
                            yield f"data: {json.dumps({'content': content})}\n\n"
                
                # 添加AI回复到历史记录
                history['messages'].append({"role": "assistant", "content": current_response})
                            
            except Exception as e:
                print(f"Error in generate function: {str(e)}")  # 添加错误日志
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        print(f"Error in chat route: {str(e)}")  # 添加错误日志
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/game/update_money', methods=['POST'])
def update_money():
    data = request.json
    # TODO: 实现金钱更新逻辑
    return jsonify({'success': True, 'new_balance': data.get('amount')})

@app.route('/api/game/update_reputation', methods=['POST'])
def update_reputation():
    data = request.json
    # TODO: 实现声望更新逻辑
    return jsonify({'success': True, 'new_reputation': data.get('amount')})

# 添加随机事件路由
@app.route('/random-event', methods=['POST'])
def generate_random_event():
    try:
        print("Received request data:", request.get_json())
        data = request.get_json()
        
        if not data:
            print("No data provided in request")
            return jsonify({'error': 'No data provided'}), 400
            
        required_fields = ['money', 'reputation', 'playerAction', 'context']
        for field in required_fields:
            if field not in data:
                print(f"Missing required field: {field}")
                return jsonify({'error': f'Missing field: {field}'}), 400

        # 使用AI生成随机事件
        event_prompt = f"""根据当前状态生成一个随机事件：
当前金钱：{data['money']}
当前声望：{data['reputation']}
玩家行为：{data['playerAction']}
上下文：{data['context']}

请生成一个有趣的随机事件，必须包含：
1. 事件标题（简短）
2. 事件描述（具体的情况说明，100字以内）

以JSON格式返回：
{{
    "type": "random_event",
    "title": "事件标题",
    "description": "详细的事件描述"
}}

注意：
1. 事件要与当前状态和玩家行为相关
2. 描述要具体且有趣
3. 不要包含预设的选项，让玩家自由决定如何应对"""

        try:
            print("Sending prompt to AI:", event_prompt)
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个JSON格式的随机事件生成器，必须严格按照指定格式输出，不要添加任何其他内容。"},
                    {"role": "user", "content": event_prompt}
                ],
                temperature=0.8
            )
            
            ai_response = response.choices[0].message.content.strip()
            print("AI response received:", ai_response)

            # 尝试清理和式化AI响应
            try:
                # 如果响应包含多余的内容，尝试提取JSON部分
                if ai_response.startswith('```json'):
                    ai_response = ai_response.split('```json')[1].split('```')[0].strip()
                elif ai_response.startswith('```'):
                    ai_response = ai_response.split('```')[1].strip()
                
                event_data = json.loads(ai_response)
                
                # 验证数据格式
                if not all(key in event_data for key in ['type', 'title', 'description']):
                    raise ValueError("Missing required fields in event data")
                
                return jsonify(event_data)
            except Exception as e:
                print(f"Error processing AI response: {e}")
                # 返回默认事件
                return jsonify({
                    'type': 'random_event',
                    'title': '意外发现',
                    'description': '你在街上发现了一些有趣的东西...',
                    'choices': [
                        {
                            'text': '仔细查看',
                            'effects': {'money': 20, 'reputation': 5}
                        }
                    ]
                })

        except Exception as e:
            print(f"Error calling AI API: {str(e)}")
            raise

    except Exception as e:
        print(f"Detailed error in generate_random_event: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/event-choice', methods=['POST'])
def handle_event_choice():
    try:
        print("Received event choice data:", request.get_json())
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        required_fields = ['accepted']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing field: {field}'}), 400

        # 使用AI生成选择结果
        choice_prompt = f"""玩家{'接受' if data['accepted'] else '拒绝'}了随机事件。
当前金钱：{data.get('currentMoney', 0)}
当前声望：{data.get('currentReputation', 0)}

请生成一个有趣的结果描述，包含：
1. 结果描述文本（简短、生动）
2. 对金钱和声望的影响

以JSON格式返回，例如：
{
    "message": "结果描述",
    "effects": {
        "money": 50,
        "reputation": 10
    }
}"""

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个中世纪佛罗伦萨的游戏事件生成器。"},
                {"role": "user", "content": choice_prompt}
            ],
            temperature=0.7
        )

        try:
            result = json.loads(response.choices[0].message.content)
            return jsonify(result)
        except json.JSONDecodeError as e:
            print(f"Error parsing AI response: {e}")
            # 如果解析失败，返回默认结果
            return jsonify({
                'message': '你的选择产生了一些影响...',
                'effects': {
                    'money': 10 if data['accepted'] else 0,
                    'reputation': 5 if data['accepted'] else 0
                }
            })
        
    except Exception as e:
        print(f"Error handling event choice: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 添加重置游戏路由
@app.route('/reset-game', methods=['POST'])
def reset_game():
    try:
        data = request.json
        session_id = data.get('sessionId')
        
        # 清除该会话的历史记录
        if session_id in chat_histories:
            chat_histories[session_id] = {
                'messages': [],
                'summary': '',
                'player_status': {
                    'role': '',
                    'major_decisions': [],
                    'assets': [],
                    'relationships': []
                }
            }
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print(f"Frontend directory: {frontend_dir}")  # 调试信息
    print(f"Frontend directory exists: {os.path.exists(frontend_dir)}")  # 检查目录是否存在
    app.run(host='localhost', port=8000, debug=True) 