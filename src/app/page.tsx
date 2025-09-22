"use client";

import { useState, useMemo, useCallback } from 'react';
import { Github, FolderUp, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Analysis {
  hasNode: boolean;
  hasPython: boolean;
  hasTypeScript: boolean;
  hasReact: boolean;
  hasNext: boolean;
  hasDocker: boolean;
  hasSQL: boolean;
  hasNoCode: boolean;
}

interface FileData {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

interface StatusState {
  step: number;
  message: string;
  inProgress: boolean;
  isError: boolean;
}

const readmeTemplate = (
  projectName: string,
  description: string,
  features: string,
  structure: string,
  techStack: string,
  installCommand: string,
  runCommand: string,
  testCommand: string,
  issuesLink: string
) =>
  `# ${projectName}

${description}

---

## Features
${features}

---

## Project Structure
${structure}

---

## Tech Stack
${techStack}

---

## Installation

\`\`\`bash
# Clone the repo
git clone ${issuesLink.replace('/issues', '.git')}

# Move into project directory
cd ${projectName}

# Install dependencies
${installCommand}
\`\`\`

---

## Usage

\`\`\`bash
# Run the project
${runCommand}

# Run tests
${testCommand}
\`\`\`

---

## Environment Variables
Create a \`.env\` file in the project root:

\`\`\`
DATABASE_URL=your_database_url
API_KEY=your_api_key
SECRET_KEY=your_secret
\`\`\`

---

## Testing

\`\`\`bash
# Run unit tests
${testCommand}
\`\`\`

---

## Documentation
- API Reference: docs/api.md
- Architecture Overview: docs/architecture.md
- Contributing Guide: CONTRIBUTING.md

---

## Contributing
1. Fork the project
2. Create your feature branch (\`git checkout -b feature/your-feature\`)
3. Commit changes (\`git commit -m 'Add some feature'\`)
4. Push to branch (\`git push origin feature/your-feature\`)
5. Open a Pull Request

---

## Issues
Found a bug? Open an issue at:
${issuesLink}

---

## Roadmap
- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

---

## Author
Your Name
LinkedIn: https://linkedin.com/in/yourname
Portfolio: https://yourportfolio.com
Email: youremail@example.com

---

## License
Distributed under the MIT License. See LICENSE file for details.
`;

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [readmeContent, setReadmeContent] = useState('');
  const [status, setStatus] = useState<StatusState>({
    step: 0,
    message: '',
    inProgress: false,
    isError: false,
  });

  const isValidUrl = useMemo(() => {
    try {
      new URL(repoUrl);
      return true;
    } catch {
      return false;
    }
  }, [repoUrl]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setLoading(true);
      setStatus({ step: 1, message: 'Analyzing local files...', inProgress: true, isError: false });

      const fileList: FileData[] = Array.from(files).map((file) => ({
        name: file.name,
        path: file.webkitRelativePath || file.name,
        type: file.name.includes('.') ? 'file' : 'dir',
      }));

      try {
        await handleGenerateReadme(fileList);
      } catch (error) {
        console.error(error);
        setStatus({
          step: 1,
          message: 'Error analyzing files. Please try again.',
          inProgress: false,
          isError: true,
        });
        setLoading(false);
      }
    },
    [handleGenerateReadme]
  );

  const getLLMGeneratedContent = async (
    prompt: string,
    statusMessage: string
  ): Promise<string | null> => {
    setStatus({
      step: status.step + 1,
      message: statusMessage,
      inProgress: true,
      isError: false,
    });

    const apiKey = "AIzaSyBdDaUjSJcSsb9iOUrOEAKrcjlL0-1tJTA";
    if (!apiKey) {
      const errorMessage = "API key is missing. Please add your Gemini API key.";
      console.error(errorMessage);
      setStatus({
        step: status.step,
        message: errorMessage,
        inProgress: false,
        isError: true,
      });
      throw new Error(errorMessage);
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      systemInstruction: {
        parts: [
          {
            text: "You are a world-class documentation expert. Your task is to generate concise and accurate text that precisely matches the user's request, without adding any extra information or conversational text. Respond only with the requested content.",
          },
        ],
      },
    };

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('API request failed:', error);
      setStatus({
        step: status.step,
        message: 'API request failed. Please check your API key.',
        inProgress: false,
        isError: true,
      });
      return null;
    }

    const result: unknown = await response.json();

    if (
      typeof result === 'object' &&
      result !== null &&
      'candidates' in result
    ) {
      const candidates = (result as any).candidates;
      const generatedText = candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        setStatus({
          step: status.step,
          message: 'No content generated by the AI.',
          inProgress: false,
          isError: true,
        });
        return null;
      }

      return generatedText;
    }

    return null;
  };

  const analyzeCodebase = useCallback((fileList: FileData[]): Analysis => {
    return {
      hasNode: fileList.some((f) => f.name === 'package.json'),
      hasPython: fileList.some(
        (f) => f.name === 'requirements.txt' || f.name.endsWith('.py')
      ),
      hasTypeScript: fileList.some(
        (f) => f.name.endsWith('.ts') || f.name.endsWith('.tsx')
      ),
      hasReact: fileList.some(
        (f) =>
          f.name.endsWith('.jsx') ||
          f.name.endsWith('.tsx') ||
          f.name.endsWith('.js') ||
          f.name.includes('react')
      ),
      hasNext: fileList.some((f) => f.name.startsWith('next.config.')),
      hasDocker: fileList.some((f) => f.name.startsWith('Dockerfile')),
      hasSQL: fileList.some((f) => f.name.endsWith('.sql')),
      hasNoCode: fileList.length === 0,
    };
  }, []);

  const getTechStack = useCallback((analysis: Analysis): string => {
    const techStackItems = [];
    if (analysis.hasNext) techStackItems.push('- Next.js');
    if (analysis.hasReact) techStackItems.push('- React');
    if (analysis.hasTypeScript) techStackItems.push('- TypeScript');
    if (analysis.hasNode) techStackItems.push('- Node.js');
    if (analysis.hasPython) techStackItems.push('- Python');
    if (analysis.hasDocker) techStackItems.push('- Docker');
    if (analysis.hasSQL) techStackItems.push('- SQL Database');
    return techStackItems.length > 0
      ? techStackItems.join('\n')
      : '- Not specified';
  }, []);

  const getCommands = useCallback((analysis: Analysis): {
    install: string;
    run: string;
    test: string;
  } => {
    if (analysis.hasNode) {
      return {
        install: 'npm install',
        run: 'npm start',
        test: 'npm test',
      };
    }
    if (analysis.hasPython) {
      return {
        install: 'pip install -r requirements.txt',
        run: 'python app.py',
        test: 'pytest',
      };
    }
    return {
      install: 'Follow project-specific instructions',
      run: 'Follow project-specific instructions',
      test: 'Follow project-specific instructions',
    };
  }, []);

  const getProjectStructure = useCallback((fileList: FileData[]): string => {
    const rootDir =
      fileList.length > 0 ? fileList[0].path.split('/')[0] : 'project-name';
    let structure = `${rootDir}/\n`;
    const paths = new Set<string>();

    fileList.forEach((file) => {
      const parts = file.path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        currentPath += parts[i] + '/';
        paths.add(currentPath);
      }
    });

    const sortedPaths = Array.from(paths).sort();

    sortedPaths.forEach((path) => {
      const parts = path.split('/').filter((p) => p !== '');
      const depth = parts.length - 1;
      const prefix = '│──' + '──'.repeat(depth);
      const name = parts[parts.length - 1];
      structure += `${prefix} ${name}/\n`;
    });

    return structure;
  }, []);

  const handleGenerateReadme = useCallback(
    async (fileList?: FileData[]) => {
      setLoading(true);
      setReadmeContent('');
      setStatus({
        step: 1,
        message: 'Starting README generation...',
        inProgress: true,
        isError: false,
      });

      let analysis: Analysis = {
        hasNode: false,
        hasPython: false,
        hasTypeScript: false,
        hasReact: false,
        hasNext: false,
        hasDocker: false,
        hasSQL: false,
        hasNoCode: true,
      };
      let repoName = 'project-name';
      let repoDescription = 'Short description of the project and its purpose.';
      let issuesLink = 'https://github.com/username/project-name/issues';

      if (repoUrl && isValidUrl) {
        setStatus({
          step: 2,
          message: 'Fetching GitHub repository data...',
          inProgress: true,
          isError: false,
        });
        const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (githubMatch) {
          const owner = githubMatch[1];
          repoName = githubMatch[2];
          issuesLink = `https://github.com/${owner}/${repoName}/issues`;

          try {
            const repoData = await (
              await fetch(`https://api.github.com/repos/${owner}/${repoName}`)
            ).json();
            if (repoData.description) {
              repoDescription = repoData.description;
            }

            const filesData = await (
              await fetch(
                `https://api.github.com/repos/${owner}/${repoName}/git/trees/main?recursive=1`
              )
            ).json();
            const githubFiles: FileData[] = filesData.tree.map((f: any) => ({
              name: f.path.split('/').pop() || '',
              path: f.path,
              type: f.type,
            }));
            analysis = analyzeCodebase(githubFiles);
          } catch (error) {
            setStatus({
              step: 2,
              message: 'Could not fetch data from GitHub. Using placeholders.',
              inProgress: false,
              isError: true,
            });
            console.error('GitHub fetch failed:', error);
          }
        }
      } else if (fileList && fileList.length > 0) {
        analysis = analyzeCodebase(fileList);
        repoName = fileList[0].name.split('/')[0];
        setStatus({
          step: 2,
          message: 'Local files analyzed.',
          inProgress: true,
          isError: false,
        });
      }

      const inferredTechStack = getTechStack(analysis);
      const {
        install: installCommand,
        run: runCommand,
        test: testCommand,
      } = getCommands(analysis);

      try {
        const features = await getLLMGeneratedContent(
          `Generate a brief, Markdown-formatted list of 3 key features for a project with the name "${repoName}" and inferred tech stack: ${Object.keys(
            analysis
          )
            .filter((key) => analysis[key as keyof Analysis])
            .join(', ')}. Format as a Markdown list.`,
          'Generating features...'
        );
        if (!features) return;

        const description = await getLLMGeneratedContent(
          `Generate a short, concise project description for a project titled "${repoName}" with the following tech stack: ${inferredTechStack
            .replace(/-/g, '')
            .replace(/\n/g, ', ')}.`,
          'Generating project description...'
        );
        if (!description) return;

        let structure = 'project-name/\n│── ...';
        if (fileList) {
          structure = getProjectStructure(fileList);
        }

        const fullReadme = readmeTemplate(
          repoName,
          description,
          features,
          structure,
          inferredTechStack,
          installCommand,
          runCommand,
          testCommand,
          issuesLink
        );

        setReadmeContent(fullReadme);
        setStatus({
          step: 4,
          message: 'README generated!',
          inProgress: false,
          isError: false,
        });
      } catch (error) {
        console.error('LLM generation failed:', error);
        setStatus({
          step: status.step,
          message: 'LLM generation failed. Check API key and try again.',
          inProgress: false,
          isError: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      repoUrl,
      isValidUrl,
      analyzeCodebase,
      getTechStack,
      getCommands,
      getProjectStructure,
      getLLMGeneratedContent,
    ]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <main className="w-full max-w-4xl flex flex-col md:flex-row gap-8 mt-10">
        <div className="flex-1 space-y-6">
          <header className="text-center">
            <h1 className="text-5xl font-extrabold text-blue-400">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                README.md
              </span>{' '}
              Generator
            </h1>
            <p className="mt-2 text-gray-400">
              Auto-generate a professional README for your GitHub repo or local
              folder.
            </p>
          </header>

          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-blue-300">
              Start Generating
            </h2>

            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex-grow w-full">
                <input
                  type="url"
                  placeholder="Enter GitHub URL (e.g., https://github.com/vercel/next.js)"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Github
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
              </div>
              <span className="text-gray-400 font-semibold">OR</span>
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full md:w-auto px-4 py-2 rounded-lg bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors duration-200 shadow-md"
              >
                <FolderUp size={20} className="mr-2" />
Upload Folder
<input
  id="file-upload"
  type="file"
  onChange={handleFileChange}
  // @ts-expect-error
  directory=""
  webkitdirectory=""
  hidden
/>
</label>
</div>

<div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 mt-6">
  <button
    onClick={() => handleGenerateReadme()}
    disabled={loading || (!repoUrl && !isValidUrl)}
    className="w-full md:w-auto px-6 py-3 rounded-lg bg-purple-500 text-white font-bold hover:bg-purple-600 transition-colors duration-200 shadow-md disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
  >
    {loading && <Loader2 className="animate-spin mr-2" size={20} />}
    Generate README
  </button>
</div>

{status.inProgress && (
  <div className="mt-4 text-center">
    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
      <div
        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
        style={{ width: `${(status.step / 4) * 100}%` }}
      />
    </div>
  </div>
)}
