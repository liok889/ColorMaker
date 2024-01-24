# ColorMaker

ColorMaker is a color design tool that makes it easy for visualization designers of all expertise to create high quality custom colormaps. Designers can easily specify their color requirements with simple drag and drop interactions. ColorMaker uses simulated annealing to generate a colormap that meets these specified preferences, while also satisfying the established perceptual guidelines.

## How to use

ColorMaker is available for use at: https://colormaker.org

## How to deploy 

You can also deploy your own instance for development or research:

1. Download ColorMaker by either cloning the repository or downloading the zip file.
2. To deploy the code, run a mini server (e.g., using Python: `python -m http.server 8080 &.`)
3. Now switch to your web browser and visit the following URL: http://localhost:8080/index.html

## Cite

If you would like to cite ColorMaker, please use the following citation

<pre>
@inproceedings{salvi2024colormaker,
    title={Color Maker: a Mixed-Initiative Approach to Creating Accessible Color Maps},
    author={Salvi, Amey A and Lu, Kecheng and Papka, Michael E. and Wang, Yunhai and Reda, Khairi},
    booktitle={Proceedings of the 2024 CHI Conference on Human Factors in Computing Systems},
    doi={10.1145/3613904.3642265},
    pages={1-17},
    year={2024}
}
</pre>
