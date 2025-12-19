import React, { useState } from 'react';
import Layout from './components/Layout';
import TraversePage from './pages/TraversePage';
import AssistantPanel from './components/AssistantPanel';
import DocumentationPage from './pages/DocumentationPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('traverse');

  const renderContent = () => {
    switch (activeTab) {
      case 'traverse':
        return <TraversePage />;
      case 'field-guide':
        return (
          <div className="h-full max-w-4xl mx-auto">
            <AssistantPanel />
          </div>
        );
      case 'docs':
        return <DocumentationPage />;
      case 'adjustments':
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-16 h-16 border-2 border-slate-700 border-dashed rounded-full flex items-center justify-center mb-4">
               <span className="font-mono text-xl">WIP</span>
            </div>
            <h3 className="text-lg font-medium text-slate-300">Adjustments Module</h3>
            <p className="text-sm max-w-md text-center mt-2">
              Advanced least squares adjustment module coming soon.
            </p>
          </div>
        );
      default:
        return <TraversePage />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;