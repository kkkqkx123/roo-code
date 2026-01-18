#!/usr/bin/env python3
"""
批量更新导入语句：将 @roo-code/types 替换为 @shared/types
"""

import os
import re
from pathlib import Path

def should_skip_file(file_path):
    """跳过不需要处理的文件"""
    skip_dirs = {'node_modules', 'dist', '.turbo', 'out', 'build'}
    skip_files = {'.tsbuildinfo'}

    # 检查是否在跳过的目录中
    for part in file_path.parts:
        if part in skip_dirs:
            return True

    # 检查文件名
    if file_path.name in skip_files:
        return True

    return False

def update_imports_in_file(file_path):
    """更新单个文件中的导入语句"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # 替换 @roo-code/types 为 @shared/types
        # 匹配各种导入形式：
        # import { ... } from "@roo-code/types"
        # import type { ... } from "@roo-code/types"
        # import * as ... from "@roo-code/types"
        # import ... from "@roo-code/types"
        pattern = r'from\s+["\']@roo-code/types["\']'
        replacement = r'from "@shared/types"'
        content = re.sub(pattern, replacement, content)

        # 如果内容有变化，写回文件
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True

        return False

    except Exception as e:
        print(f"处理文件 {file_path} 时出错: {e}")
        return False

def main():
    """主函数"""
    # 获取项目根目录
    project_root = Path(__file__).parent.parent
    src_dir = project_root / "src"

    if not src_dir.exists():
        print(f"错误: src 目录不存在: {src_dir}")
        return

    print(f"开始扫描目录: {src_dir}")
    print("=" * 60)

    # 统计信息
    total_files = 0
    updated_files = 0
    skipped_files = 0

    # 遍历所有 TypeScript 文件
    for file_path in src_dir.rglob("*.ts"):
        if should_skip_file(file_path):
            skipped_files += 1
            continue

        total_files += 1

        # 检查文件是否包含 @roo-code/types 导入
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if '@roo-code/types' in content:
                    if update_imports_in_file(file_path):
                        updated_files += 1
                        print(f"✓ 已更新: {file_path.relative_to(project_root)}")
        except Exception as e:
            print(f"✗ 读取文件失败 {file_path}: {e}")

    print("=" * 60)
    print(f"扫描完成！")
    print(f"总文件数: {total_files}")
    print(f"已更新文件: {updated_files}")
    print(f"跳过文件: {skipped_files}")

if __name__ == "__main__":
    main()