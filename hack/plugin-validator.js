#!/usr/bin/env node

/**
 * Plugin Definition Validator
 *
 * This script validates plugin definitions against Claude Code marketplace standards
 * and provides detailed feedback on missing or incorrect metadata.
 */

const fs = require("fs");
const path = require("path");

// Required fields for complete plugin definitions
const REQUIRED_FIELDS = {
  root: ["name", "version", "description", "author"],
  author: ["name"],
  components: [], // components can be empty, but if present should have valid structure
};

// Recommended fields for enhanced discoverability
const RECOMMENDED_FIELDS = [
  "displayName",
  "longDescription",
  "category",
  "subcategory",
  "keywords",
  "tags",
  "license",
  "homepage",
  "repository",
  "installation",
  "usage",
  "security",
  "support",
];

// Valid categories and subcategories
const VALID_CATEGORIES = {
  Productivity: [
    "Automation",
    "Project Management",
    "Time Tracking",
    "Documentation",
  ],
  Development: ["Tools", "Testing", "Debugging", "Code Generation", "AI/ML"],
  Integration: ["APIs", "Services", "Databases", "Cloud"],
  Utilities: ["File Management", "System", "Network", "Security"],
  Documentation: ["Learning", "Reference", "Help", "Examples"],
};

class PluginValidator {
  constructor(pluginPath) {
    this.pluginPath = pluginPath;
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  validate(plugin) {
    console.log(`🔍 Validating plugin: ${plugin.name || "Unknown"}\n`);

    // Validate root structure
    this.validateRootFields(plugin);

    // Validate author information
    this.validateAuthor(plugin.author);

    // Validate version format
    this.validateVersion(plugin.version);

    // Validate category and subcategory
    this.validateCategory(plugin.category, plugin.subcategory);

    // Validate components
    this.validateComponents(plugin.components);

    // Validate security information
    this.validateSecurity(plugin.security);

    // Validate usage information
    this.validateUsage(plugin.usage);

    // Check for recommended fields
    this.checkRecommendedFields(plugin);

    // Generate suggestions for improvement
    this.generateSuggestions(plugin);

    return this.generateReport();
  }

  validateRootFields(plugin) {
    REQUIRED_FIELDS.root.forEach((field) => {
      if (!plugin[field]) {
        this.errors.push(`Missing required field: ${field}`);
      } else if (field !== "author" && typeof plugin[field] !== "string") {
        this.errors.push(`Field ${field} must be a string`);
      }
    });

    // Validate description length
    if (plugin.description) {
      if (plugin.description.length < 10) {
        this.warnings.push(
          "Description is too short (should be at least 10 characters)",
        );
      }
      if (plugin.description.length > 200) {
        this.warnings.push(
          "Description is too long (should be under 200 characters)",
        );
      }
    }
  }

  validateAuthor(author) {
    if (!author) {
      this.errors.push("Missing required field: author");
      return;
    }

    REQUIRED_FIELDS.author.forEach((field) => {
      if (!author[field]) {
        this.errors.push(`Missing required author field: ${field}`);
      }
    });

    // Check for preferred author fields
    if (author.email && !this.isValidEmail(author.email)) {
      this.warnings.push("Author email format appears invalid");
    }

    if (author.url && !this.isValidUrl(author.url)) {
      this.warnings.push("Author URL format appears invalid");
    }
  }

  validateVersion(version) {
    if (!version) {
      this.errors.push("Missing required field: version");
      return;
    }

    // Semantic versioning pattern
    const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?(\+[a-zA-Z0-9-]+)?$/;
    if (!semverPattern.test(version)) {
      this.warnings.push("Version should follow semantic versioning (x.y.z)");
    }
  }

  validateCategory(category, subcategory) {
    if (!category) {
      this.warnings.push("Missing category field (affects discoverability)");
      return;
    }

    if (!VALID_CATEGORIES[category]) {
      this.warnings.push(
        `Unknown category: ${category}. Valid categories: ${Object.keys(VALID_CATEGORIES).join(", ")}`,
      );
      return;
    }

    if (subcategory && !VALID_CATEGORIES[category].includes(subcategory)) {
      this.warnings.push(
        `Unknown subcategory: ${subcategory} for category: ${category}. Valid subcategories: ${VALID_CATEGORIES[category].join(", ")}`,
      );
    }
  }

  validateComponents(components) {
    if (!components) {
      this.suggestions.push(
        "Consider adding components (commands, agents, skills) to enhance plugin functionality",
      );
      return;
    }

    const componentTypes = ["commands", "agents", "skills", "mcpServers"];

    componentTypes.forEach((type) => {
      if (components[type]) {
        if (!Array.isArray(components[type])) {
          this.errors.push(`Components.${type} must be an array`);
        } else {
          components[type].forEach((component, index) => {
            this.validateComponent(type, component, index);
          });
        }
      }
    });
  }

  validateComponent(type, component, index) {
    const componentId = `${type}[${index}]`;

    if (!component.name) {
      this.errors.push(`${componentId}: Missing required field: name`);
    }

    if (!component.description) {
      this.errors.push(`${componentId}: Missing required field: description`);
    }

    // Type-specific validation
    switch (type) {
      case "commands":
        this.validateCommand(component, componentId);
        break;
      case "agents":
        this.validateAgent(component, componentId);
        break;
      case "skills":
        this.validateSkill(component, componentId);
        break;
      case "mcpServers":
        this.validateMcpServer(component, componentId);
        break;
    }
  }

  validateCommand(command, componentId) {
    if (!command.usage) {
      this.warnings.push(
        `${componentId}: Missing usage field (helps users understand how to use the command)`,
      );
    }

    if (command.examples && !Array.isArray(command.examples)) {
      this.errors.push(`${componentId}: Examples field must be an array`);
    }
  }

  validateAgent(agent, componentId) {
    if (!agent.capabilities || !Array.isArray(agent.capabilities)) {
      this.warnings.push(
        `${componentId}: Missing capabilities array (helps users understand what the agent can do)`,
      );
    }

    if (!agent.model) {
      this.warnings.push(
        `${componentId}: Missing model specification (recommended for agents)`,
      );
    }
  }

  validateSkill(skill, componentId) {
    if (!skill.category) {
      this.warnings.push(
        `${componentId}: Missing category field (helps with skill organization)`,
      );
    }

    if (!skill.input || !skill.output) {
      this.warnings.push(
        `${componentId}: Missing input/output specifications (helps users understand skill interface)`,
      );
    }
  }

  validateMcpServer(server, componentId) {
    if (!server.command) {
      this.errors.push(`${componentId}: Missing required command field`);
    }

    if (!server.args || !Array.isArray(server.args)) {
      this.warnings.push(
        `${componentId}: Missing args array (required for MCP server execution)`,
      );
    }
  }

  validateSecurity(security) {
    if (!security) {
      this.suggestions.push("Add security information to build user trust");
      return;
    }

    if (!security.permissions || !Array.isArray(security.permissions)) {
      this.warnings.push(
        "Security.permissions should be an array of required permissions",
      );
    }

    if (!security.privacy) {
      this.warnings.push(
        "Security.privacy description helps users understand data handling",
      );
    }
  }

  validateUsage(usage) {
    if (!usage) {
      this.suggestions.push(
        "Add usage information to help users get started quickly",
      );
      return;
    }

    if (!usage.quickStart) {
      this.warnings.push(
        "Usage.quickStart helps users get started immediately",
      );
    }

    if (usage.examples && !Array.isArray(usage.examples)) {
      this.errors.push("Usage.examples must be an array");
    }
  }

  checkRecommendedFields(plugin) {
    RECOMMENDED_FIELDS.forEach((field) => {
      if (!plugin[field]) {
        this.suggestions.push(
          `Consider adding ${field} field for better plugin presentation`,
        );
      }
    });
  }

  generateSuggestions(plugin) {
    // Content quality suggestions
    if (plugin.longDescription && plugin.longDescription.length < 100) {
      this.suggestions.push(
        "Consider expanding longDescription to provide more value proposition details",
      );
    }

    if (plugin.keywords && plugin.keywords.length < 3) {
      this.suggestions.push(
        "Add more keywords to improve discoverability (aim for 5-10 relevant terms)",
      );
    }

    // Component suggestions
    if (plugin.components) {
      const componentCount = Object.keys(plugin.components).length;
      if (componentCount === 0) {
        this.suggestions.push(
          "Consider adding at least one component type (commands, agents, or skills)",
        );
      } else if (componentCount === 1 && plugin.components.commands) {
        this.suggestions.push(
          "Consider adding agents or skills to provide more advanced functionality",
        );
      }
    }

    // Documentation suggestions
    if (plugin.support && !plugin.support.documentation) {
      this.suggestions.push(
        "Add support.documentation link for comprehensive help resources",
      );
    }
  }

  generateReport() {
    const report = {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      score: this.calculateQualityScore(),
    };

    return report;
  }

  calculateQualityScore() {
    let score = 100;

    // Deduct points for errors
    score -= this.errors.length * 20;

    // Deduct points for warnings
    score -= this.warnings.length * 5;

    // Small deduction for missing suggestions
    score -= this.suggestions.length * 2;

    return Math.max(0, Math.min(100, score));
  }

  isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  printReport(report) {
    console.log("📊 Plugin Validation Report\n");

    // Overall status
    const status = report.valid ? "✅ VALID" : "❌ INVALID";
    const scoreEmoji =
      report.score >= 90
        ? "🌟"
        : report.score >= 80
          ? "✨"
          : report.score >= 70
            ? "📈"
            : "⚠️";
    console.log(
      `Status: ${status} ${scoreEmoji} Quality Score: ${report.score}/100\n`,
    );

    // Errors
    if (report.errors.length > 0) {
      console.log("🚨 ERRORS (Must Fix):");
      report.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log();
    }

    // Warnings
    if (report.warnings.length > 0) {
      console.log("⚠️  WARNINGS (Recommended):");
      report.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
      console.log();
    }

    // Suggestions
    if (report.suggestions.length > 0) {
      console.log("💡 SUGGESTIONS (Enhancement):");
      report.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
      console.log();
    }

    // Summary
    if (report.valid) {
      console.log(
        "🎉 Plugin definition meets all requirements and is ready for marketplace submission!",
      );
    } else {
      console.log(
        "🔧 Please fix the errors above before submitting to the marketplace.",
      );
    }
  }
}

// CLI usage
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: node plugin-validator.js <plugin-file.json>");
    process.exit(1);
  }

  const pluginPath = args[0];

  if (!fs.existsSync(pluginPath)) {
    console.error(`Error: Plugin file not found: ${pluginPath}`);
    process.exit(1);
  }

  try {
    const pluginData = fs.readFileSync(pluginPath, "utf8");
    const plugin = JSON.parse(pluginData);

    const validator = new PluginValidator(pluginPath);
    const report = validator.validate(plugin);

    validator.printReport(report);

    process.exit(report.valid ? 0 : 1);
  } catch (error) {
    console.error(`Error reading or parsing plugin file: ${error.message}`);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { PluginValidator };

// Run CLI if called directly
if (require.main === module) {
  main();
}
