class SkillCheck < Formula
  desc "Linter for agent skill files"
  homepage "https://github.com/thedaviddias/skill-check"
  url "https://github.com/thedaviddias/skill-check.git", branch: "main"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--omit=dev", "--ignore-scripts", *std_npm_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "Built-in rules", shell_output("#{bin}/skill-check rules")
  end
end
