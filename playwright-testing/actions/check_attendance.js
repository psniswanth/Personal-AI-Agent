async page => {
  const SEMESTER = 'Fall Semester 2026-27 - VLR';

  // Navigate to Academics -> Class Attendance
  await page.getByRole('button', { name: '  Academics' }).click();
  await page.getByRole('link', { name: /Class Attendance/i }).click();
  const semesterSelect = page.getByRole('combobox');
  await semesterSelect.waitFor();
  await semesterSelect.selectOption(SEMESTER);
  await page.waitForTimeout(3000); // wait for table to update after semester selection
  await page.waitForSelector('#AttendanceDetailDataTable', { timeout: 10000 });
  const rows = await page.locator('#AttendanceDetailDataTable tbody tr').all();
  const results = [];

  for (const row of rows) {
    const cells = await row.locator('td').all();
    if (cells.length >= 8) {
      const courseDetailText = await cells[2].textContent();
      const attendedText = await cells[5].textContent();
      const totalText = await cells[6].textContent();
      const percentageText = await cells[7].textContent();

      const parts = courseDetailText.trim().split(' - ');
      const course_code = parts[0] ? parts[0].trim() : '';
      const course_title = parts[1] ? parts[1].trim() : '';

      results.push({
        course_code,
        course_title,
        attended: parseInt(attendedText.trim(), 10),
        total: parseInt(totalText.trim(), 10),
        percentage: percentageText.trim()
      });
    }
  }

  return results;
}
