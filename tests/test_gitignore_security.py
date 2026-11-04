"""
Unit tests for Git Ignore Security Rules and Workspace Configuration.

This module validates that the repository's `.gitignore` configuration
rigorously excludes all sensitive, insecure, private, and temporary files,
while properly allowing standard public website assets.

Built with pure Python standard library modules with zero external dependencies.
"""

from dataclasses import dataclass
import os
from pathlib import Path
import subprocess
import sys
from typing import Final, List, Sequence, Tuple
import unittest


# The repository root directory path.
REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class CheckResult:
    """Immutable result holder for git check-ignore queries."""

    target_path: str
    is_ignored: bool
    matching_rule: str


def sanitize_relative_path(file_path: str) -> str:
    """
    Sanitize and validate a relative file path for git queries.

    Args:
        file_path: The file path string to validate.

    Returns:
        The normalized path string with standard forward slashes.

    Raises:
        TypeError: If file_path is not a string.
        ValueError: If file_path is empty or contains only whitespace.
    """
    if not isinstance(file_path, str):
        raise TypeError(f"Expected file_path as str, got {type(file_path).__name__}")
    normalized = file_path.strip().replace("\\", "/")
    if not normalized:
        raise ValueError("file_path cannot be empty or whitespace only")
    return normalized


def query_git_is_ignored(repo_path: Path, relative_file_path: str) -> CheckResult:
    """
    Query Git directly using 'git check-ignore' to determine if a path is excluded.

    This executes real Git logic without mock objects.

    Args:
        repo_path: Absolute Path to the Git repository root.
        relative_file_path: Relative file or directory path to test.

    Returns:
        A CheckResult instance containing the ignore status and matching rule.

    Raises:
        FileNotFoundError: If repo_path does not exist on disk.
        subprocess.SubprocessError: If Git encounters a fatal execution failure.
    """
    if not repo_path.is_dir():
        raise FileNotFoundError(f"Repository directory does not exist: {repo_path}")

    cleaned_path = sanitize_relative_path(relative_file_path)

    # Command: git check-ignore -v --no-index <path>
    # Returns 0 if ignored (with matching rule in stdout), 1 if not ignored.
    command = ["git", "check-ignore", "-v", "--no-index", cleaned_path]

    process = subprocess.run(
        command,
        cwd=str(repo_path),
        capture_output=True,
        text=True,
        check=False,
    )

    if process.returncode == 0:
        output_line = process.stdout.strip()
        return CheckResult(
            target_path=cleaned_path,
            is_ignored=True,
            matching_rule=output_line,
        )
    elif process.returncode == 1:
        return CheckResult(
            target_path=cleaned_path,
            is_ignored=False,
            matching_rule="",
        )
    else:
        raise subprocess.SubprocessError(
            f"git check-ignore failed with code {process.returncode}: {process.stderr}"
        )


class TestGitIgnoreFileIntegrity(unittest.TestCase):
    """Test suite verifying the existence and basic integrity of .gitignore."""

    def test_gitignore_exists_and_is_not_empty(self) -> None:
        """Verify that .gitignore is located at the project root and has content."""
        gitignore_path = REPO_ROOT / ".gitignore"
        self.assertTrue(
            gitignore_path.is_file(),
            f".gitignore file is missing at repository root: {gitignore_path}",
        )
        content = gitignore_path.read_text(encoding="utf-8")
        self.assertGreater(
            len(content.strip()),
            0,
            ".gitignore file must not be empty.",
        )

    def test_gitignore_contains_required_security_sections(self) -> None:
        """Verify that .gitignore includes definitions for key security categories."""
        gitignore_path = REPO_ROOT / ".gitignore"
        content = gitignore_path.read_text(encoding="utf-8").lower()

        required_patterns = [
            ".env",
            "*.pem",
            "*.key",
            "id_rsa*",
            "credentials*",
            "*.token",
            "thumbs.db",
            ".ds_store",
            "node_modules/",
            "*.bak",
            "*.log",
        ]

        for pattern in required_patterns:
            with self.subTest(pattern=pattern):
                self.assertIn(
                    pattern,
                    content,
                    f"Pattern '{pattern}' should be present in .gitignore",
                )


class TestGitIgnoreExcludesInsecureFiles(unittest.TestCase):
    """Rigorous functional test suite ensuring real insecure paths are excluded by Git."""

    def test_excludes_environment_and_secret_files(self) -> None:
        """Verify environment files and secret configurations are excluded."""
        insecure_env_targets: Sequence[str] = (
            ".env",
            ".env.production",
            ".env.local",
            ".env.development.local",
            "secrets.json",
            "secret_key.txt",
            "credentials.xml",
            "credentials.json",
            "config/credentials.json",
            "nested/dir/.env",
        )
        for target in insecure_env_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertTrue(
                    result.is_ignored,
                    f"Insecure file '{target}' should be excluded by .gitignore",
                )

    def test_excludes_cryptographic_private_keys_and_certs(self) -> None:
        """Verify private keys, certificates, and SSH keys are excluded."""
        crypto_targets: Sequence[str] = (
            "id_rsa",
            "id_rsa.pub",
            "id_ed25519",
            "id_ecdsa",
            "server.key",
            "private.pem",
            "cert.pfx",
            "identity.p12",
            "truststore.jks",
            "nested/keys/server.key",
        )
        for target in crypto_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertTrue(
                    result.is_ignored,
                    f"Cryptographic key '{target}' should be excluded by .gitignore",
                )

    def test_excludes_cloud_and_auth_credentials(self) -> None:
        """Verify authentication tokens, cloud credential stores, and netrc are excluded."""
        auth_targets: Sequence[str] = (
            ".aws/credentials",
            ".aws/config",
            ".gcloud/credentials.db",
            ".azure/accessTokens.json",
            "auth.token",
            "session.jwt",
            "serviceAccountKey.json",
            "client_secret_oauth.json",
            ".netrc",
            ".htpasswd",
        )
        for target in auth_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertTrue(
                    result.is_ignored,
                    f"Authentication store '{target}' should be excluded by .gitignore",
                )

    def test_excludes_operating_system_and_ide_clutter(self) -> None:
        """Verify operating system metadata and IDE configuration files are excluded."""
        system_targets: Sequence[str] = (
            "Thumbs.db",
            "desktop.ini",
            ".DS_Store",
            ".AppleDouble",
            ".vscode/settings.json",
            ".idea/workspace.xml",
            "index.html.swp",
            ".claude/config.json",
            ".gemini/settings.json",
        )
        for target in system_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertTrue(
                    result.is_ignored,
                    f"System/IDE file '{target}' should be excluded by .gitignore",
                )

    def test_excludes_temporary_backups_logs_and_build_artifacts(self) -> None:
        """Verify backup files, log files, and build outputs are excluded."""
        artifact_targets: Sequence[str] = (
            "index.html.bak",
            "archive.old",
            "script.tmp",
            "file.backup",
            "app.log",
            "npm-debug.log",
            "yarn-error.log",
            "core.dmp",
            "node_modules/package/index.js",
            "dist/bundle.js",
            "build/output.css",
            "data.sqlite",
            "backup.sql",
        )
        for target in artifact_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertTrue(
                    result.is_ignored,
                    f"Temporary or build artifact '{target}' should be excluded by .gitignore",
                )


class TestGitIgnoreAllowsSafePublicFiles(unittest.TestCase):
    """Negative test suite ensuring legitimate public website assets are NOT ignored."""

    def test_allows_public_documentation_and_code_assets(self) -> None:
        """Verify standard public repository files remain trackable and not ignored."""
        safe_targets: Sequence[str] = (
            "index.html",
            "README.md",
            "README.txt",
            "LICENSE",
            "LICENSE.txt",
            "assets/css/main.css",
            "assets/js/main.js",
            "images/avatar.jpg",
            "images/banner.jpg",
            "LeeSC.png",
            "my first",
        )
        for target in safe_targets:
            with self.subTest(target=target):
                result = query_git_is_ignored(REPO_ROOT, target)
                self.assertFalse(
                    result.is_ignored,
                    f"Legitimate public asset '{target}' must NOT be ignored by .gitignore",
                )


class TestSanitizeRelativePathErrorHandling(unittest.TestCase):
    """Edge cases and negative input tests for path sanitization."""

    def test_valid_strings(self) -> None:
        """Verify normal paths with forward or backward slashes are normalized."""
        self.assertEqual(sanitize_relative_path("dir\\file.txt"), "dir/file.txt")
        self.assertEqual(sanitize_relative_path("  file.txt  "), "file.txt")

    def test_invalid_types_raise_type_error(self) -> None:
        """Verify non-string inputs raise TypeError."""
        for invalid_input in (None, 123, [], {}, True):
            with self.subTest(invalid_input=invalid_input):
                with self.assertRaises(TypeError):
                    sanitize_relative_path(invalid_input)  # type: ignore

    def test_empty_or_whitespace_strings_raise_value_error(self) -> None:
        """Verify empty and whitespace strings raise ValueError."""
        for invalid_string in ("", "   ", "\t\n"):
            with self.subTest(invalid_string=invalid_string):
                with self.assertRaises(ValueError):
                    sanitize_relative_path(invalid_string)

    def test_nonexistent_repo_path_raises_file_not_found(self) -> None:
        """Verify querying a nonexistent directory raises FileNotFoundError."""
        fake_path = REPO_ROOT / "nonexistent_repo_dir_12345"
        with self.assertRaises(FileNotFoundError):
            query_git_is_ignored(fake_path, "test.txt")


if __name__ == "__main__":
    unittest.main()
