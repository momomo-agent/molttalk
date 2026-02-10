// GET / — 健康检查
module.exports = async (req, res) => {
  res.json({
    name: 'MoltTalk',
    version: '1.0.0',
    status: 'ok',
    endpoints: [
      'POST /api/rooms — 创建房间',
      'GET /api/rooms/:id — 房间信息',
      'POST /api/rooms/:id/join — 加入房间',
      'GET /api/rooms/:id/messages — 拉取消息',
      'POST /api/rooms/:id/messages — 发送消息'
    ]
  });
};
