import 'package:flutter/material.dart';
import '../../core/palette.dart';
import '../room/den_game.dart';

/// Slim always-on chat input bar.
///
/// No message history. All chat is shown as floating speech bubbles
/// above avatars in the world. When the user taps the input, the OS
/// keyboard slides up and this bar rides on top of it via
/// `MediaQuery.viewInsets.bottom`. The Flame room sits behind and stays
/// visible above the keyboard.
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
  final TextEditingController _input = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _input.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    widget.game.spawnChatBubble(widget.myUserId, text);
    _input.clear();
    // Keep keyboard up so the user can fire off another message
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: const BoxDecoration(
          color: DenPalette.surface,
          border: Border(
            top: BorderSide(color: DenPalette.border, width: 1),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x59000000),
              blurRadius: 12,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(Icons.lock, size: 14, color: DenPalette.accent),
            ),
            Expanded(
              child: TextField(
                controller: _input,
                focusNode: _focusNode,
                style: const TextStyle(color: DenPalette.text, fontSize: 14),
                cursorColor: DenPalette.accent,
                decoration: InputDecoration(
                  hintText: 'Say something...',
                  hintStyle: const TextStyle(color: DenPalette.textMuted),
                  filled: true,
                  fillColor: DenPalette.surfaceAlt,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: const BorderSide(
                        color: DenPalette.accent, width: 1.2),
                  ),
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
                child: const Icon(Icons.arrow_forward_rounded,
                    size: 20, color: Colors.black),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
