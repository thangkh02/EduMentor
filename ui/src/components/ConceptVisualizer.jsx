import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useTool } from '../services/api';

const ConceptVisualizer = ({ concept }) => {
  const svgRef = useRef(null);
  const [conceptData, setConceptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConceptData = async () => {
      if (!concept) return;
      
      setLoading(true);
      try {
        const result = await useTool('concept', concept);
        // Transform the response into a hierarchical structure for visualization
        const hierarchyData = {
          name: concept,
          children: Object.entries(result.response.related_concepts || {}).map(([key, value]) => ({
            name: key,
            description: value,
            children: []
          }))
        };
        setConceptData(hierarchyData);
        setError(null);
      } catch (err) {
        console.error("Error fetching concept data:", err);
        setError("Failed to load concept visualization");
      } finally {
        setLoading(false);
      }
    };

    fetchConceptData();
  }, [concept]);

  useEffect(() => {
    if (!conceptData || !svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create a hierarchical layout
    const root = d3.hierarchy(conceptData);
    const treeLayout = d3.tree().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    treeLayout(root);

    // Add links between nodes
    svg.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x))
      .attr("fill", "none")
      .attr("stroke", "#4299e1")
      .attr("stroke-width", 1.5);

    // Add nodes
    const nodes = svg.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    // Add circles to nodes
    nodes.append("circle")
      .attr("r", 8)
      .attr("fill", d => d.depth === 0 ? "#3182ce" : "#4299e1");

    // Add labels to nodes
    nodes.append("text")
      .attr("dy", ".31em")
      .attr("x", d => d.children ? -12 : 12)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .attr("fill", "white");

  }, [conceptData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-x-auto">
      <h2 className="text-xl font-bold mb-4">Concept Visualization: {concept}</h2>
      <svg ref={svgRef} className="w-full" style={{ minWidth: '800px' }}></svg>
    </div>
  );
};

export default ConceptVisualizer;