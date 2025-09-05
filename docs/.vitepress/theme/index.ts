import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window !== 'undefined') {
      // Initialize Mermaid when the app starts
      const initMermaid = async () => {
        try {
          console.log('Initializing Mermaid...');
          const { default: mermaid } = await import('mermaid');

          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
              primaryColor: '#3b82f6',
              primaryTextColor: '#1f2937',
              primaryBorderColor: '#e5e7eb',
              lineColor: '#6b7280',
              secondaryColor: '#f3f4f6',
              tertiaryColor: '#ffffff',
            },
          });

          console.log('Mermaid initialized successfully');

          // Function to render mermaid diagrams
          const renderMermaidDiagrams = async () => {
            // Try multiple selectors to find mermaid code blocks
            let mermaidElements = document.querySelectorAll('pre code.language-mermaid');

            // If not found, try alternative selectors
            if (mermaidElements.length === 0) {
              mermaidElements = document.querySelectorAll('code.language-mermaid');
            }
            if (mermaidElements.length === 0) {
              mermaidElements = document.querySelectorAll('pre[class*="language-mermaid"] code');
            }
            if (mermaidElements.length === 0) {
              mermaidElements = document.querySelectorAll('[class*="language-mermaid"]');
            }

            console.log(`Found ${mermaidElements.length} mermaid diagrams to render`);

            for (let i = 0; i < mermaidElements.length; i++) {
              const element = mermaidElements[i] as HTMLElement;

              // Skip if already processed
              if (element.getAttribute('data-mermaid-processed')) {
                continue;
              }

              let graphDefinition = element.textContent || '';

              // Clean up the text content - remove "mermaid" prefix if present
              if (graphDefinition.startsWith('mermaid')) {
                graphDefinition = graphDefinition.substring(7).trim();
              }

              const graphId = `mermaid-diagram-${Date.now()}-${i}`;

              // Mark as being processed
              element.setAttribute('data-mermaid-processed', 'processing');

              // Create container for the diagram
              const container = document.createElement('div');
              container.className = 'mermaid-diagram';
              container.id = graphId;

              try {
                // Render the mermaid diagram
                const { svg } = await mermaid.render(graphId, graphDefinition);
                container.innerHTML = svg;

                // Find the correct parent element to replace (the <pre> element)
                const preElement = element.parentElement; // This should be <pre>
                console.log('Element structure:', {
                  element: element.tagName,
                  parent: preElement?.tagName,
                  grandparent: preElement?.parentElement?.tagName,
                });

                if (preElement && preElement.tagName === 'PRE') {
                  // Replace only the <pre> element, not its parent
                  preElement.parentElement?.replaceChild(container, preElement);
                } else {
                  // Fallback: replace the element itself if structure is different
                  element.parentElement?.replaceChild(container, element);
                }
              } catch (error) {
                console.error('Mermaid rendering failed:', error);
                // Keep the original code block on error
                element.setAttribute('data-mermaid-processed', 'error');
              }
            }
          };

          // Render diagrams on initial load
          renderMermaidDiagrams();

          // Re-render on route changes
          router.onAfterRouteChange = () => {
            setTimeout(renderMermaidDiagrams, 100);
          };
        } catch (error) {
          console.error('Failed to initialize Mermaid:', error);
        }
      };

      // Initialize after DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMermaid);
      } else {
        initMermaid();
      }
    }
  },
} satisfies Theme;
