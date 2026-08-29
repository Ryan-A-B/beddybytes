plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("**/*.kt")
        targetExclude("**/build/**", ".gradle/**", ".gradle-docker/**")
        ktlint(libs.versions.ktlint.get())
    }
    kotlinGradle {
        target("**/*.gradle.kts")
        targetExclude("**/build/**", ".gradle/**", ".gradle-docker/**")
        ktlint(libs.versions.ktlint.get())
    }
    format("misc") {
        target("**/*.md", "**/.gitignore", "**/*.properties")
        targetExclude("**/build/**", ".gradle/**", ".gradle-docker/**")
        trimTrailingWhitespace()
        endWithNewline()
    }
}
