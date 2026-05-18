import 'package:flutter/material.dart';
import '../../core/palette.dart';
import '../room/den_game.dart';

class ChatMessage {
  final String userId;
  final String text;
  final DateTime sentAt;
  final bool isMe;

  const ChatMessage({
    required this.userId,
    required this.text,
    required this.sentAt,
    required this.isMe,
  });
}

/// Sliding chat panel that sits at the bottom of the room screen.
/// Tapping the bar expands it; sending a message also spawns a floating
/// speech bubble above the speaker via [game.spawnChatBubble].
class ChatOverlay extends StatefulWidget {
  final String friendId;
  final String myUserId;
  final DenGame game;

  const ChatOverlay({
    super.key,
    required this.friendId,
    required this.myUserId,
    required this.game,
  });

  @override
  State<ChatOverlay> createState() => _ChatOverlayState();
}

class _ChatOverlayState extends State<ChatOverlay> {
  bool _expanded = false;
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final FocusNode _focusNode = FocusNode();

  final List<ChatMessage> _messages = [];

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add(ChatMessage(
        userId: widget.myUserId,
        text: text,
        sentAt: DateTime.now(),
        isMe: true,
      ));
      _input.clear();
    });

    // Float bubble above my avatar in the room
    widget.game.spawnChatBubble(widget.myUserId, text);

    // TODO: encrypt with Signal Double Ratchet and send via WebSocket

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragUpdate: (d) {
        if (d.delta.dy < -6) setState(() => _expanded = true);
        if (d.delta.dy > 6) setState(() => _expanded = false);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeInOut,
        height: _expanded ? 380 : 56,
        decoration: const BoxDecoration(
          color: DenPalette.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(
              color: Color(0x66000000),
              blurRadius: 16,
              offset: Offset(0, -4),
            )
          ],
        ),
        child: Column(
          children: [
            GestureDetector(
              onTap: () {
                setState(() => _expanded = !_expanded);
                if (_expanded) {
                  Future.delayed(const Duration(milliseconds: 120), () {
                    if (mounted) _focusNode.requestFocus();
                  });
                }
              },
              child: Container(
                height: 56,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: DenPalette.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.lock, size: 14, color: DenPalette.accent),
                    const SizedBox(width: 6),
                    Text(
                      widget.friendId,
                      style: const TextStyle(
                        color: DenPalette.text,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'E2E encrypted',
                      style: TextStyle(
                        color: DenPalette.accent.withOpacity(0.8),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) => _MessageBubble(msg: _messages[i]),
                ),
              ),
              Container(
                color: DenPalette.surface,
                padding: EdgeInsets.only(
                  left: 12,
                  right: 8,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 8,
                  top: 8,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        focusNode: _focusNode,
                        style: const TextStyle(
                            color: DenPalette.text, fontSize: 14),
                        decoration: const InputDecoration(
                          hintText: 'Message...',
                          hintStyle: TextStyle(color: DenPalette.textMuted),
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _send,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: const BoxDecoration(
                          color: DenPalette.accent,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.send_rounded,
                            size: 18, color: Colors.black),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage msg;
  const _MessageBubble({required this.msg});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: msg.isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.72,
        ),
        decoration: BoxDecoration(
          color: msg.isMe ? DenPalette.bubbleMe : DenPalette.bubbleThem,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(msg.isMe ? 16 : 4),
            bottomRight: Radius.circular(msg.isMe ? 4 : 16),
          ),
        ),
        child: Text(
          msg.text,
          style: const TextStyle(
            color: DenPalette.text,
            fontSize: 14,
            height: 1.35,
          ),
        ),
      ),
    );
  }
}
