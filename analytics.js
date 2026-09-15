(function (global) {
  function linearTrend(values) {
    if (!Array.isArray(values) || values.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const x = values.map((_, i) => i);
    const n = x.length;
    const meanX = x.reduce((acc, v) => acc + v, 0) / n;
    const meanY = values.reduce((acc, v) => acc + v, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i += 1) {
      const dx = x[i] - meanX;
      const dy = values[i] - meanY;
      numerator += dx * dy;
      denominator += dx * dx;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;
    const predicted = x.map((v) => intercept + slope * v);
    const ssRes = values.reduce((acc, y, i) => acc + (y - predicted[i]) ** 2, 0);
    const ssTot = values.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
    const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

    return { slope, intercept, r2: Number.isFinite(r2) ? r2 : 0 };
  }

  function describeModel(modelName, values) {
    if (!values || !values.length) {
      return { label: modelName, direction: 'Sin datos', trend: 0, r2: 0 };
    }

    const trend = linearTrend(values);
    const direction = trend.slope >= 0 ? 'crecimiento' : 'decrecimiento';

    return {
      label: modelName,
      direction,
      trend: trend.slope,
      r2: trend.r2
    };
  }

  global.DynamicSystemsAnalytics = {
    linearTrend,
    describeModel
  };
}(window));
