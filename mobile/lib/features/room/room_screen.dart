import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import '../../core/palette.dart';
import '../chat/chat_overlay.dart';
import 'den_game.dart';

/// Full-screen room: Flame isometric world behind, chat panel on top.
/// When chatting, tap outside the keyboard to dismiss it.
class RoomScreen extends StatefulWidget {
  final String roomOwnerId;
  final String myUserId;

  const RoomScreen({
    super.key,
    required this.roomOwnerId,
    required this.myUserId,
  });

  @override
  State<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  late final DenGame _game;

  @override
  void initState() {
    super.initState();
    _game = DenGame(
      roomOwnerId: widget.roomOwnerId,
      myUserId: widget.myUserId,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false, // Flame handles keyboard insets
      body: Stack(
        children: [
          // ── Sky gradient behind the game ──────────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [DenPalette.skyTop, DenPalette.skyBottom],
              ),
            ),
          ),

          // ── Flame isometric room ──────────────────────────────────
          GameWidget(game: _game),

          // ── Top bar ───────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  // Back / friends list
                  _IconButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: 10),
                  // Room owner label
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: DenPalette.surface.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: DenPalette.border.withOpacity(0.6)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.home_rounded,
                            size: 14, color: DenPalette.accent),
                        const SizedBox(width: 6),
                        Text(
                          "${widget.roomOwnerId}'s den",
                          style: const TextStyle(
                            color: DenPalette.text,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  // Avatar customise shortcut
                  _IconButton(
                    icon: Icons.person_rounded,
                    onTap: () {
                      // TODO: open avatar customiser sheet
                    },
                  ),
                ],
              ),
            ),
          ),

          // ── Chat overlay at bottom ────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ChatOverlay(
              friendId: widget.roomOwnerId,
              myUserId: widget.myUserId,
            ),
          ),
        ],
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: DenPalette.surface.withOpacity(0.85),
          shape: BoxShape.circle,
          border: Border.all(color: DenPalette.border.withOpacity(0.6)),
        ),
        child: Icon(icon, size: 16, color: DenPalette.text),
      ),
    );
  }
}
