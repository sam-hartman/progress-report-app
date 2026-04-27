"""Generate test images simulating student work for QPR app e2e testing."""
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """Try to load a readable font, fall back to default."""
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def get_handwriting_font(size: int) -> ImageFont.FreeTypeFont:
    """Try to load a handwriting-style font."""
    candidates = [
        "/Library/Fonts/Bradley Hand Bold.ttf",
        "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf",
        "/Library/Fonts/Noteworthy.ttc",
        "/System/Library/Fonts/Noteworthy.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return get_font(size)


def draw_table(draw: ImageDraw.Draw, x: int, y: int, headers: list[str],
               rows: list[list[str]], col_widths: list[int],
               row_height: int = 35, font: ImageFont.FreeTypeFont | None = None,
               header_bg: str = "#2B579A", header_fg: str = "white",
               line_color: str = "#666666") -> int:
    """Draw a table and return the y position after it."""
    f = font or get_font(16)
    total_w = sum(col_widths)

    # Header row
    draw.rectangle([x, y, x + total_w, y + row_height], fill=header_bg)
    cx = x
    for i, h in enumerate(headers):
        draw.text((cx + 8, y + 8), h, fill=header_fg, font=f)
        cx += col_widths[i]
    y += row_height

    # Data rows
    for ri, row in enumerate(rows):
        bg = "#F5F5F5" if ri % 2 == 0 else "white"
        draw.rectangle([x, y, x + total_w, y + row_height], fill=bg)
        cx = x
        for i, cell in enumerate(row):
            draw.text((cx + 8, y + 8), cell, fill="#333333", font=f)
            cx += col_widths[i]
        y += row_height

    # Grid lines
    # Horizontal
    cy = y - row_height * len(rows) - row_height
    for _ in range(len(rows) + 2):
        draw.line([(x, cy), (x + total_w, cy)], fill=line_color, width=1)
        cy += row_height
    # Vertical
    cx = x
    top = y - row_height * (len(rows) + 1)
    for w in col_widths:
        draw.line([(cx, top), (cx, y)], fill=line_color, width=1)
        cx += w
    draw.line([(x + total_w, top), (x + total_w, y)], fill=line_color, width=1)

    return y


def create_grade_table() -> None:
    """Image 1: A printed grade/score table for a 3rd grade class."""
    img = Image.new("RGB", (800, 1000), "white")
    draw = ImageDraw.Draw(img)
    title_font = get_font(24)
    body_font = get_font(15)
    small_font = get_font(13)

    # Header
    draw.rectangle([0, 0, 800, 80], fill="#2B579A")
    draw.text((30, 15), "Westfield Elementary School", fill="white", font=title_font)
    draw.text((30, 48), "3rd Grade - Mrs. Johnson | Q3 2025-2026", fill="#CCDDFF", font=body_font)

    # Subject header
    draw.text((30, 100), "Mathematics - Unit Assessment Scores", fill="#2B579A", font=get_font(20))
    draw.line([(30, 128), (770, 128)], fill="#2B579A", width=2)

    headers = ["Student Name", "Quiz 1", "Quiz 2", "Test 1", "Quiz 3", "Test 2", "Avg"]
    col_widths = [180, 80, 80, 80, 80, 80, 80]
    rows = [
        ["Aiden M.", "88", "92", "85", "90", "87", "88.4"],
        ["Brianna T.", "95", "98", "92", "97", "94", "95.2"],
        ["Carlos R.", "72", "78", "70", "75", "73", "73.6"],
        ["Destiny W.", "85", "82", "88", "80", "86", "84.2"],
        ["Elijah P.", "90", "88", "95", "92", "91", "91.2"],
        ["Fatima A.", "68", "72", "65", "70", "68", "68.6"],
        ["George L.", "82", "85", "80", "83", "81", "82.2"],
        ["Hannah K.", "94", "96", "90", "93", "95", "93.6"],
        ["Isaiah D.", "76", "80", "74", "78", "77", "77.0"],
        ["Jasmine C.", "91", "89", "93", "88", "90", "90.2"],
    ]
    y = draw_table(draw, 30, 145, headers, rows, col_widths, font=body_font)

    # Legend
    y += 20
    draw.text((30, y), "Grading Scale:", fill="#333", font=get_font(14))
    y += 22
    for label, color in [("A: 90-100", "#2E7D32"), ("B: 80-89", "#1565C0"),
                          ("C: 70-79", "#F57F17"), ("D: 60-69", "#E65100"),
                          ("F: Below 60", "#C62828")]:
        draw.rectangle([30, y, 45, y + 15], fill=color)
        draw.text((52, y), label, fill="#333", font=small_font)
        y += 20

    # Footer
    y += 15
    draw.text((30, y), "Maryland College and Career Ready Standards (MCCRS) - Math 3.OA, 3.NBT", fill="#666", font=small_font)
    draw.text((30, y + 18), "Printed: March 15, 2026", fill="#999", font=small_font)

    img.save(os.path.join(OUT, "01_grade_table.png"), quality=95)
    print("Created 01_grade_table.png")


def create_reading_assessment() -> None:
    """Image 2: A reading assessment rubric with scores filled in."""
    img = Image.new("RGB", (800, 950), "white")
    draw = ImageDraw.Draw(img)
    title_font = get_font(22)
    body_font = get_font(15)
    hand_font = get_handwriting_font(20)
    small_font = get_font(12)

    # School header
    draw.rectangle([0, 0, 800, 70], fill="#8B0000")
    draw.text((30, 12), "Maple Ridge Middle School", fill="white", font=title_font)
    draw.text((30, 42), "Reading & Language Arts Assessment", fill="#FFCCCC", font=body_font)

    # Student info block
    y = 90
    draw.rectangle([30, y, 770, y + 90], outline="#999", width=1)
    draw.text((45, y + 8), "Student:", fill="#333", font=body_font)
    draw.text((130, y + 5), "Marcus Williams", fill="#1a1aaa", font=hand_font)
    draw.line([(125, y + 28), (350, y + 28)], fill="#999", width=1)

    draw.text((400, y + 8), "Grade:", fill="#333", font=body_font)
    draw.text((470, y + 5), "5th", fill="#1a1aaa", font=hand_font)
    draw.line([(465, y + 28), (550, y + 28)], fill="#999", width=1)

    draw.text((45, y + 40), "Teacher:", fill="#333", font=body_font)
    draw.text((140, y + 37), "Mr. Okonkwo", fill="#1a1aaa", font=hand_font)
    draw.line([(135, y + 60), (350, y + 60)], fill="#999", width=1)

    draw.text((400, y + 40), "Date:", fill="#333", font=body_font)
    draw.text((460, y + 37), "3/10/2026", fill="#1a1aaa", font=hand_font)
    draw.line([(455, y + 60), (600, y + 60)], fill="#999", width=1)

    draw.text((560, y + 8), "Quarter:", fill="#333", font=body_font)
    draw.text((640, y + 5), "Q3", fill="#1a1aaa", font=hand_font)

    # Rubric table
    y += 110
    draw.text((30, y), "Reading Comprehension Rubric", fill="#8B0000", font=get_font(18))
    y += 30

    headers = ["Skill Area", "1-Below", "2-Approach", "3-Proficient", "4-Advanced", "Score"]
    col_widths = [200, 90, 100, 100, 100, 70]
    skills = [
        ["Main Idea & Details", "", "", "", "X", "4"],
        ["Vocabulary in Context", "", "", "X", "", "3"],
        ["Inference & Prediction", "", "X", "", "", "2"],
        ["Text Structure", "", "", "X", "", "3"],
        ["Author's Purpose", "", "", "", "X", "4"],
        ["Compare & Contrast", "", "", "X", "", "3"],
        ["Summarization", "", "X", "", "", "2"],
        ["Critical Analysis", "", "", "X", "", "3"],
    ]
    y = draw_table(draw, 30, y, headers, skills, col_widths, font=body_font,
                   header_bg="#8B0000")

    # Summary
    y += 20
    draw.rectangle([30, y, 770, y + 80], outline="#8B0000", width=2)
    draw.text((45, y + 8), "Total Score: 24/32  |  Percentage: 75%  |  Grade: C",
              fill="#333", font=get_font(16))
    draw.text((45, y + 35), "Performance Level: Approaching Expectations",
              fill="#E65100", font=get_font(14))
    draw.text((45, y + 55), "MCCRS Standard: RL.5.1, RL.5.2, RL.5.4, RL.5.5, RL.5.6",
              fill="#666", font=small_font)

    # Teacher notes
    y += 100
    draw.text((30, y), "Teacher Notes:", fill="#333", font=get_font(16))
    y += 25
    notes = [
        "Marcus shows strong skills in identifying main ideas and",
        "understanding author's purpose. He needs additional support",
        "with inference and summarization. Recommend guided reading",
        "group focusing on making predictions and drawing conclusions.",
        "IEP Goal 2.3: Reading comprehension at grade level - in progress."
    ]
    for line in notes:
        draw.text((30, y), line, fill="#1a1aaa", font=hand_font)
        y += 24

    img.save(os.path.join(OUT, "02_reading_assessment.png"), quality=95)
    print("Created 02_reading_assessment.png")


def create_science_lab() -> None:
    """Image 3: A science lab worksheet with data table and observations."""
    img = Image.new("RGB", (800, 1100), "white")
    draw = ImageDraw.Draw(img)
    title_font = get_font(22)
    body_font = get_font(15)
    hand_font = get_handwriting_font(18)
    small_font = get_font(12)

    # Header
    draw.rectangle([0, 0, 800, 70], fill="#1B5E20")
    draw.text((30, 12), "Cedar Park Elementary", fill="white", font=title_font)
    draw.text((30, 42), "4th Grade Science Lab Report", fill="#A5D6A7", font=body_font)

    y = 85
    draw.text((30, y), "Plant Growth Experiment - Week 4 Results", fill="#1B5E20", font=get_font(20))
    y += 30

    # Student info
    draw.text((30, y), "Name:", fill="#333", font=body_font)
    draw.text((90, y - 2), "Sofia Martinez", fill="#1a1aaa", font=hand_font)
    draw.text((400, y), "Date:", fill="#333", font=body_font)
    draw.text((450, y - 2), "March 8, 2026", fill="#1a1aaa", font=hand_font)
    y += 35

    # Hypothesis
    draw.text((30, y), "Hypothesis:", fill="#1B5E20", font=get_font(16))
    y += 22
    draw.text((30, y), "Plants with more sunlight will grow taller than", fill="#1a1aaa", font=hand_font)
    y += 22
    draw.text((30, y), "plants with less sunlight.", fill="#1a1aaa", font=hand_font)
    y += 35

    # Data table
    draw.text((30, y), "Observation Data:", fill="#1B5E20", font=get_font(16))
    y += 25

    headers = ["Plant", "Light (hrs)", "Week 1", "Week 2", "Week 3", "Week 4", "Growth"]
    col_widths = [120, 100, 80, 80, 80, 80, 90]
    rows = [
        ["Plant A", "8 hours", "2.1 cm", "4.3 cm", "7.8 cm", "12.5 cm", "+10.4 cm"],
        ["Plant B", "4 hours", "1.8 cm", "3.1 cm", "5.2 cm", "8.0 cm", "+6.2 cm"],
        ["Plant C", "2 hours", "1.5 cm", "2.4 cm", "3.6 cm", "5.1 cm", "+3.6 cm"],
        ["Plant D", "0 hours", "1.2 cm", "1.5 cm", "1.8 cm", "2.0 cm", "+0.8 cm"],
        ["Plant E (ctrl)", "6 hours", "2.0 cm", "3.8 cm", "6.5 cm", "10.2 cm", "+8.2 cm"],
    ]
    y = draw_table(draw, 30, y, headers, rows, col_widths, font=body_font,
                   header_bg="#1B5E20")

    # Observations
    y += 20
    draw.text((30, y), "Observations:", fill="#1B5E20", font=get_font(16))
    y += 25
    observations = [
        "1. Plant A grew the most because it got the most sun.",
        "2. Plant D barely grew at all with no light. Its leaves",
        "   turned yellow by week 3.",
        "3. The control plant (E) grew almost as much as Plant A.",
        "4. All plants with light grew green leaves. Plant D did not.",
        "5. I noticed Plant B started leaning toward the window.",
    ]
    for line in observations:
        draw.text((30, y), line, fill="#1a1aaa", font=hand_font)
        y += 22

    # Conclusion
    y += 15
    draw.text((30, y), "Conclusion:", fill="#1B5E20", font=get_font(16))
    y += 25
    conclusions = [
        "My hypothesis was correct! Plants with more sunlight",
        "grew taller. Plant A (8hrs) grew 10.4cm but Plant D",
        "(0hrs) only grew 0.8cm. This shows plants need light",
        "for photosynthesis to make food and grow.",
    ]
    for line in conclusions:
        draw.text((30, y), line, fill="#1a1aaa", font=hand_font)
        y += 22

    # Teacher grade box
    y += 25
    draw.rectangle([30, y, 350, y + 100], outline="#1B5E20", width=2)
    draw.rectangle([30, y, 350, y + 30], fill="#1B5E20")
    draw.text((40, y + 5), "Teacher Evaluation", fill="white", font=body_font)
    draw.text((40, y + 38), "Score: 45/50  (90%)", fill="#333", font=get_font(16))
    draw.text((40, y + 62), "NGSS: 4-LS1-1, 4-PS3-2", fill="#666", font=small_font)
    draw.text((40, y + 78), "Great work, Sofia!", fill="#1a1aaa", font=hand_font)

    img.save(os.path.join(OUT, "03_science_lab.png"), quality=95)
    print("Created 03_science_lab.png")


def create_behavior_checklist() -> None:
    """Image 4: A behavioral/social-emotional progress checklist."""
    img = Image.new("RGB", (800, 900), "white")
    draw = ImageDraw.Draw(img)
    title_font = get_font(22)
    body_font = get_font(15)
    small_font = get_font(12)

    # Header
    draw.rectangle([0, 0, 800, 70], fill="#4A148C")
    draw.text((30, 12), "Behavioral & Social-Emotional Progress", fill="white", font=title_font)
    draw.text((30, 42), "Quarterly Monitoring Form", fill="#CE93D8", font=body_font)

    y = 85
    info = [
        ("Student:", "Jaylen Thompson"),
        ("Grade:", "2nd"),
        ("School:", "Greenfield Elementary"),
        ("Quarter:", "Q3 2025-2026"),
        ("Counselor:", "Ms. Rivera"),
    ]
    for label, val in info:
        draw.text((30, y), label, fill="#333", font=body_font)
        draw.text((130, y), val, fill="#333", font=get_font(15))
        y += 22
    y += 10

    headers = ["Behavior Area", "Rarely", "Sometimes", "Often", "Consistently"]
    col_widths = [250, 90, 100, 90, 110]
    behaviors = [
        ["Follows classroom rules", "", "", "X", ""],
        ["Respects peers and adults", "", "", "", "X"],
        ["Manages frustration appropriately", "", "X", "", ""],
        ["Participates in group activities", "", "", "X", ""],
        ["Completes work independently", "", "X", "", ""],
        ["Transitions between activities", "", "", "X", ""],
        ["Uses kind words", "", "", "", "X"],
        ["Asks for help when needed", "X", "", "", ""],
        ["Stays on task during instruction", "", "X", "", ""],
        ["Resolves conflicts peacefully", "", "", "X", ""],
    ]
    y = draw_table(draw, 30, y, headers, behaviors, col_widths, font=body_font,
                   header_bg="#4A148C")

    y += 20
    draw.text((30, y), "IEP Behavioral Goals Progress:", fill="#4A148C", font=get_font(16))
    y += 25
    goals = [
        ("Goal 1:", "Reduce off-task behavior to <3 incidents/day", "In Progress - currently at 4-5/day"),
        ("Goal 2:", "Use coping strategies independently", "Partial - needs 1 prompt"),
        ("Goal 3:", "Initiate peer interactions during recess", "Met - observed 3+ times/week"),
    ]
    for g, desc, status in goals:
        draw.text((30, y), g, fill="#4A148C", font=get_font(14))
        draw.text((90, y), desc, fill="#333", font=small_font)
        y += 18
        draw.text((90, y), f"Status: {status}", fill="#666", font=small_font)
        y += 25

    img.save(os.path.join(OUT, "04_behavior_checklist.png"), quality=95)
    print("Created 04_behavior_checklist.png")


if __name__ == "__main__":
    create_grade_table()
    create_reading_assessment()
    create_science_lab()
    create_behavior_checklist()
    print(f"\nAll test images saved to {OUT}/")
