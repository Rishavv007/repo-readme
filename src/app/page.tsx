 "use client";

import { useState } from 'react';
import { Github, Loader2, FileText, Bot, FolderUp } from 'lucide-react';

interface FileInfo {
  name: string;
  webkitRelativePath: string;
}

interface Analysis {
  hasNode: boolean;
  hasPython: boolean;
  hasReact: boolean;
  hasTypeScript: boolean;
  hasNext: boolean;
}

// The main application component for the RepoReadme app.
const Home = () => {
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  // The hard-coded template for the README file. The AI will only fill in the placeholders.
  const readmeTemplate = (projectName: string, description: string, features: string, structure: string, techStack: string, installCommand: string, runCommand: string, testCommand: string, issuesLink: string): string => `
# ${projectName}

${description}

---

## Features
${features}

---

## Project Structure
\`\`\`
${structure}
\`\`\`

---

## Tech Stack
${techStack}

---

## Installation

# Clone the repo
\`\`\`bash
git clone [repository_url]
\`\`\`

# Move into project directory
\`\`\`bash
cd ${projectName}
\`\`\`

# Install dependencies
\`\`\`bash
${installCommand}
\`\`\`

---

## Usage

# Run the project
\`\`\`bash
${runCommand}
\`\`\`

# Run tests
\`\`\`bash
${testCommand}
\`\`\`

Example API request:

\`\`\`
GET /api/v1/users
Host: localhost:3000
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

# Run unit tests
\`\`\`bash
${testCommand}
\`\`\`

# Run integration tests
\`\`\`bash
${testCommand} --integration
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
  `.trim();

  // Modular function to get a specific piece of content from the LLM.
  const getLLMGeneratedContent = async (prompt: string, label: string): Promise<string | null> => {
    setAnalysisStatus(label);
    // Paste your API key here to fix the 403 error.
    const apiKey = "AIzaSyBdDaUjSJcSsb9iOUrOEAKrcjlL0-1tJTA";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    let retryCount = 0;
    const maxRetries = 5;
    let delay = 1000;

    while (retryCount < maxRetries) {
      try {
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ "google_search": {} }],
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`Rate limit exceeded. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
            retryCount++;
            continue;
          }
          throw new Error(`API request failed with status: ${response.status}`);
        }

        const result = await response.json();
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          return generatedText;
        } else {
          throw new Error('No content generated from the API.');
        }

      } catch (err: unknown) {
        let errorMessage = 'An unknown error occurred.';
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        console.error("API call failed:", errorMessage);
        setError(`Failed to generate ${label.toLowerCase()}. Please try again.`);
        return null;
      }
    }
    
    console.error("Max retries reached. API call failed.");
    setError(`Failed to generate ${label.toLowerCase()} after multiple attempts.`);
    return null;
  };

  // Analyze the uploaded files to provide a better prompt to the LLM.
  const analyzeFiles = (files: FileInfo[]): Analysis => {
    const analysis = {
      hasNode: files.some(file => file.name === 'package.json'),
      hasPython: files.some(file => file.name === 'requirements.txt' || file.name.endsWith('.py')),
      hasReact: files.some(file => file.name.endsWith('.jsx') || file.name.endsWith('.tsx')),
      hasTypeScript: files.some(file => file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name === 'tsconfig.json'),
      hasNext: files.some(file => file.webkitRelativePath.includes('next.config.js') || file.webkitRelativePath.includes('app/')),
    };
    return analysis;
  };

  // Fetch repository data from GitHub API.
  const fetchGitHubRepoData = async (url: string) => {
    setAnalysisStatus('Fetching data from GitHub...');
    try {
      const urlParts = url.split('/').filter(part => part);
      const repoName = urlParts.pop();
      const ownerName = urlParts.pop();
      if (!repoName || !ownerName) {
        throw new Error('Invalid GitHub URL format.');
      }

      const apiUrl = `https://api.github.com/repos/${ownerName}/${repoName}`;
      const contentsUrl = `https://api.github.com/repos/${ownerName}/${repoName}/contents`;
      
      const [repoResponse, contentsResponse] = await Promise.all([
        fetch(apiUrl),
        fetch(contentsUrl)
      ]);
      
      if (!repoResponse.ok) {
        throw new Error(`Failed to fetch repository data. Status: ${repoResponse.status}`);
      }
      if (!contentsResponse.ok) {
        throw new Error(`Failed to fetch repository contents. Status: ${contentsResponse.status}`);
      }

      const repoData = await repoResponse.json();
      const contentsData: { path: string }[] = await contentsResponse.json();
      
      const filePaths = contentsData.map(item => item.path);

      // Perform analysis based on the files from the GitHub API
      const analysis = analyzeFiles(filePaths.map(path => ({ name: path.split('/').pop() || '', webkitRelativePath: path })));

      return {
        repoName: repoData.name,
        description: repoData.description,
        filePaths: filePaths,
        analysis: analysis
      };
    } catch (e: unknown) {
      let errorMessage = 'An unknown error occurred.';
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      console.error(e);
      setError(`Error fetching GitHub data: ${errorMessage}`);
      return null;
    }
  };

  // Handle file selection from the directory input.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map(file => ({
        name: file.name,
        webkitRelativePath: file.webkitRelativePath,
      }));
      setUploadedFiles(files);
      setRepoUrl('');
    }
  };

  // This is the main function that handles the README generation process.
  const handleGenerateReadme = async () => {
    if (!repoUrl && uploadedFiles.length === 0) {
      setError('Please enter a GitHub repository URL or upload a folder.');
      return;
    }

    setIsLoading(true);
    setReadmeContent('');
    setError('');

    try {
      let repoName: string, analysis: Analysis, installCommand: string, runCommand: string, testCommand: string, issuesLink: string, structure: string, description: string;

      if (repoUrl) {
        const githubData = await fetchGitHubRepoData(repoUrl);
        if (!githubData) {
          setIsLoading(false);
          return;
        }

        repoName = githubData.repoName;
        description = githubData.description;
        analysis = githubData.analysis;
        issuesLink = `${repoUrl}/issues`;

        const fileTree = githubData.filePaths.map(file => `|── ${file}`).join('\n');
        structure = fileTree;

        installCommand = analysis.hasPython ? 'pip install -r requirements.txt' : 'npm install';
        runCommand = analysis.hasPython ? 'python main.py' : 'npm start';
        testCommand = analysis.hasPython ? 'pytest' : 'npm test';

      } else {
        repoName = uploadedFiles[0].webkitRelativePath.split('/')[0] || 'my-project';
        analysis = analyzeFiles(uploadedFiles);
        description = "This project automatically generates well-formatted README files.";
        issuesLink = "https://github.com/username/project-name/issues";
        
        const fileTree = uploadedFiles.map(file => `|── ${file.webkitRelativePath}`).join('\n');
        structure = fileTree;
        
        installCommand = analysis.hasPython ? 'pip install -r requirements.txt' : 'npm install';
        runCommand = analysis.hasPython ? 'python main.py' : 'npm start';
        testCommand = analysis.hasPython ? 'pytest' : 'npm test';
      }

      // Generate the dynamic content using separate, focused LLM calls
      const features = await getLLMGeneratedContent(
        `Generate a brief, Markdown-formatted list of 3 key features for a project with the name "${repoName}" and inferred tech stack: ${Object.keys(analysis).filter(key => analysis[key]).join(', ')}. Format as a Markdown list.`,
        'Generating features...'
      );
      if (!features) return;

      const techStack = await getLLMGeneratedContent(
        `Generate a brief, Markdown-formatted list of 3-5 key technologies for a project named "${repoName}" with the following file analysis: ${JSON.stringify(analysis)}. Format as a Markdown list.`,
        'Generating tech stack...'
      );
      if (!techStack) return;

      // Assemble the final README from the template and generated content
      const finalReadme = readmeTemplate(repoName, description, features, structure, techStack, installCommand, runCommand, testCommand, issuesLink);
      setReadmeContent(finalReadme);
      
    } catch (err: unknown) {
      let errorMessage = 'An unexpected error occurred.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error(err);
      setError('An unexpected error occurred. Please check the URL or folder and try again.');
    } finally {
      setIsLoading(false);
      setAnalysisStatus('');
    }
  };

  // The main UI of the application.
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <Github className="w-12 h-12 text-gray-700 dark:text-gray-300" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white text-center">
            RepoReadme Generator
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center max-w-md">
            Instantly generate a professional README.md for your GitHub repository or local project.
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 dark:placeholder-gray-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter GitHub repository URL (e.g., https://github.com/user/repo)"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setUploadedFiles([]); // Clear files when URL is typed
              }}
              disabled={uploadedFiles.length > 0}
            />
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>

          <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
            <span className="bg-gray-200 dark:bg-gray-700 h-px flex-grow rounded-full"></span>
            <span className="px-4 text-sm">OR</span>
            <span className="bg-gray-200 dark:bg-gray-700 h-px flex-grow rounded-full"></span>
          </div>

          <div className="relative flex items-center justify-center">
            <label htmlFor="folder-upload" className={`w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 font-medium transition-colors cursor-pointer ${repoUrl ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <FolderUp className="w-5 h-5" />
              <span>Select Code Folder</span>
              <input 
                id="folder-upload" 
                type="file" 
                className="hidden" 
                webkitdirectory="" 
                directory="" 
                onChange={handleFileChange}
                disabled={!!repoUrl}
              />
            </label>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                Files Selected:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <li key={index}>{file.webkitRelativePath}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleGenerateReadme}
            disabled={isLoading || (!repoUrl && uploadedFiles.length === 0)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                <span>{analysisStatus}</span>
              </>
            ) : (
              <>
                <Bot className="w-5 h-5" />
                <span>Generate README</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {readmeContent && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center space-x-2">
              <FileText className="w-6 h-6" />
              <span>Generated README.md</span>
            </h2>
            <pre className="p-4 overflow-x-auto whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
              {readmeContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
